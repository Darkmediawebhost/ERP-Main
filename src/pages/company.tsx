import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge, Button, Card, ErrorText, Field, Modal, Money, PageHeader, Select, Spinner, Table, Td, TextArea, TextInput, Th } from '@/components/ui';
import { applyTheme, useAuth, useToast } from '@/context';
import { api, errorMessage, idempotencyKey } from '@/lib/api';
import { inr, monthKey, todayKey, weekRange } from '@/lib/format';
import { EVENT_TYPES, PERMISSIONS } from '@/lib/labels';

type Row = Record<string, any>;

export function EmployeesPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const form = useForm<Record<string, string>>();
  const load = () => api.get('/employees', { params: { limit: 100 } }).then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);
  const blank = { fullName: '', designation: '', salary: '' };
  const openNew = () => { setEditing(null); setError(''); form.reset(blank); setOpen(true); };
  const openEdit = (row: Row) => {
    setEditing(row);
    setError('');
    form.reset({ fullName: row.fullName || '', designation: row.designation || '', salary: (Number(row.salaryPaise || 0) / 100).toFixed(2) });
    setOpen(true);
  };
  return (
    <div>
      <PageHeader title="Employees" text="Name, designation, and monthly salary." action={can('employees.manage') && <Button onClick={openNew}>Add employee</Button>} />
      {error && !open && <ErrorText>{error}</ErrorText>}
      <Table><thead><tr><Th>Name</Th><Th>Designation</Th><Th>Monthly salary</Th><Th></Th></tr></thead><tbody>
        {rows.map((row) => <tr key={row._id}><Td>{row.fullName}</Td><Td>{row.designation}</Td><Td><Money paise={row.salaryPaise} /></Td><Td>{can('employees.manage') && <Button variant="quiet" onClick={() => openEdit(row)}>Edit</Button>}</Td></tr>)}
      </tbody></Table>
      {open && <Modal title={editing ? 'Edit employee' : 'New employee'} onClose={() => { setOpen(false); setEditing(null); }}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const payload = { fullName: values.fullName, designation: values.designation, salary: values.salary };
        try {
          if (editing) {
            await api.patch(`/employees/${editing._id}`, payload);
            toast('Employee updated');
          } else {
            await api.post('/employees', payload);
            toast('Employee added');
          }
          setOpen(false);
          setEditing(null);
          form.reset(blank);
          load();
        } catch (err) { setError(errorMessage(err)); }
      })}>
        <Field label="Name"><TextInput placeholder="Ayesha Khan" {...form.register('fullName', { required: true })} /></Field>
        <Field label="Designation"><TextInput placeholder="Video editor" {...form.register('designation', { required: true })} /></Field>
        <Field label="Monthly salary"><TextInput inputMode="decimal" placeholder="25000" {...form.register('salary', { required: true })} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">{editing ? 'Save' : 'Add employee'}</Button>
      </form></Modal>}
    </div>
  );
}

export function AttendancePage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const load = () => api.get('/attendance', { params: { month: monthKey() } }).then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHeader title="Attendance" text="Check-in and check-out calculate working minutes. Edits are written to the audit log." action={<div className="grid w-full grid-cols-2 gap-2"><Button className="w-full" onClick={async () => { try { await api.post('/attendance/check-in', {}); toast('Checked in'); load(); } catch (err) { setError(errorMessage(err)); } }}>Check in</Button><Button className="w-full" variant="ghost" onClick={async () => { try { await api.post('/attendance/check-out', {}); toast('Checked out'); load(); } catch (err) { setError(errorMessage(err)); } }}>Check out</Button></div>} />
      {error && <ErrorText>{error}</ErrorText>}
      <Table><thead><tr><Th>Employee</Th><Th>Date</Th><Th>In</Th><Th>Out</Th><Th>Minutes</Th><Th>Late</Th></tr></thead><tbody>
        {rows.map((row) => <tr key={row._id}><Td>{row.employeeId?.fullName}</Td><Td>{row.dateKey}</Td><Td>{row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</Td><Td>{row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</Td><Td>{row.workMinutes || 0}</Td><Td>{row.late ? 'Late' : ''}</Td></tr>)}
      </tbody></Table>
    </div>
  );
}

export function SalaryPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [pay, setPay] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const key = useRef(idempotencyKey());
  const form = useForm<Record<string, string>>({ defaultValues: { date: todayKey(), advanceRecovery: '0' } });
  const load = () => api.get('/salary').then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); api.get('/banks').then((response) => setBanks(response.data.data)); }, []);
  return (
    <div>
      <PageHeader title="Salary" text="Paying salary creates the expense, the bank movement, and the ledger entries together. The same employee and month cannot be paid twice." action={<Button onClick={async () => { try { const response = await api.post('/salary/generate', { month: monthKey() }); toast(`Prepared ${response.data.data.created} salary records`); load(); } catch (err) { setError(errorMessage(err)); } }}>Prepare this month</Button>} />
      {error && !pay && <ErrorText>{error}</ErrorText>}
      <Table><thead><tr><Th>Employee</Th><Th>Month</Th><Th>Base</Th><Th>Net</Th><Th>Status</Th><Th></Th></tr></thead><tbody>
        {rows.map((row) => <tr key={row._id}><Td>{row.employeeId?.fullName}</Td><Td>{row.monthKey}</Td><Td><Money paise={row.basePaise} /></Td><Td><Money paise={row.status === 'paid' ? row.netPaise : row.basePaise + row.bonusPaise - row.deductionPaise} /></Td><Td><Badge tone={row.status === 'paid' ? 'success' : 'neutral'}>{row.status}</Badge></Td><Td className="space-x-2">{row.status !== 'paid' && <Button variant="quiet" onClick={() => setPay(row)}>Pay</Button>}<a className="text-sm font-semibold" href={`/api/salary/${row._id}/slip`}>Slip</a></Td></tr>)}
      </tbody></Table>
      {pay && <Modal title={`Pay ${pay.employeeId?.fullName}`} onClose={() => { setPay(null); setError(''); }}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const account = banks.find((bank) => bank._id === values.bankAccountId);
        const recoveryPaise = Math.round(Number(values.advanceRecovery || 0) * 100);
        const netPaise = Number(pay.basePaise || 0) + Number(pay.bonusPaise || 0) - Number(pay.deductionPaise || 0) - recoveryPaise;
        if (account && !account.allowOverdraft && netPaise > Number(account.currentBalancePaise || 0)) {
          setError(`${account.accountName} has ${inr(account.currentBalancePaise)}. This salary needs ${inr(netPaise)}. Record income into that account, or choose another one.`);
          return;
        }
        try {
          await api.post(`/salary/${pay._id}/pay`, { ...values, idempotencyKey: key.current });
          toast('Salary paid');
          setPay(null);
          setError('');
          key.current = idempotencyKey();
          load();
        } catch (err) { setError(errorMessage(err)); }
      })}>
        <Field label="Date"><TextInput type="date" {...form.register('date')} /></Field>
        <Field label="Pay from"><Select {...form.register('bankAccountId', { required: true })}><option value="">Select an account</option>{banks.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName} · {inr(bank.currentBalancePaise)}</option>)}</Select></Field>
        <p className="text-sm text-secondary">The account must already hold the salary. Company Cash cannot go below zero.</p>
        <Field label="Recover advance"><TextInput {...form.register('advanceRecovery')} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">Pay and post</Button>
      </form></Modal>}
    </div>
  );
}

export function CalendarPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(todayKey().slice(0, 7));
  const form = useForm<Record<string, string>>({ defaultValues: { date: todayKey(), eventType: 'Business Meeting' } });
  const load = () => api.get('/calendar', { params: { from: `${cursor}-01`, to: `${cursor}-31` } }).then((response) => setRows(response.data.data));
  useEffect(() => { load(); }, [cursor]);
  const [year, month] = cursor.split('-').map(Number);
  const startWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (
    <div>
      <PageHeader title="Calendar" text="Meetings, deadlines, and reminders live on the company calendar." action={<Button onClick={() => setOpen(true)}>Add event</Button>} />
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><Button className="w-full" variant="ghost" onClick={() => setCursor(shiftMonth(cursor, -1))}>Previous</Button><p className="px-1 text-center text-sm font-semibold">{cursor}</p><Button className="w-full" variant="ghost" onClick={() => setCursor(shiftMonth(cursor, 1))}>Next</Button></div>
      <div className="grid grid-cols-7 gap-1 text-sm sm:gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <p key={day} className="text-center text-[10px] uppercase text-secondary sm:text-xs"><span className="sm:hidden">{day.slice(0, 1)}</span><span className="hidden sm:inline">{day}</span></p>)}
        {Array.from({ length: startWeekday }).map((_, index) => <div key={`pad-${index}`} />)}
        {Array.from({ length: days }).map((_, index) => {
          const date = `${cursor}-${String(index + 1).padStart(2, '0')}`;
          const events = rows.filter((row) => row.dateKey === date);
          return <div key={date} className="min-h-16 rounded-xl border border-line bg-card p-1 sm:min-h-20 sm:rounded-2xl sm:p-2"><p className="text-[10px] text-secondary sm:text-xs">{index + 1}</p>{events.map((event) => <p key={event._id} className="truncate text-[10px] sm:text-xs">{event.title}</p>)}</div>;
        })}
      </div>
      {open && <Modal title="New event" onClose={() => setOpen(false)}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => { await api.post('/calendar', values); toast('Event added'); setOpen(false); load(); })}>
        <Field label="Title"><TextInput {...form.register('title', { required: true })} /></Field>
        <Field label="Type"><Select {...form.register('eventType')}>{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</Select></Field>
        <Field label="Date"><TextInput type="date" {...form.register('date')} /></Field>
        <Field label="Start"><TextInput {...form.register('startTime')} placeholder="10:00" /></Field>
        <Field label="Description"><TextArea {...form.register('description')} /></Field>
        <Button type="submit">Save</Button>
      </form></Modal>}
    </div>
  );
}

const LIGHT_COLORS = ['#FFF4CC', '#FFE8D6', '#FDE2E4', '#E7F6D5', '#D7E3FC', '#E0F4FF', '#F3E8FF', '#E7F6F2', '#FFF1E6', '#F8E1F4'];
const NOTE_EXTRAS = 'dm-note-extras';

function randomLight() {
  return LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)];
}

type NoteExtra = { color?: string; reminderTime?: string; googleEventId?: string };

function readNoteExtras(): Record<string, NoteExtra> {
  try { return JSON.parse(localStorage.getItem(NOTE_EXTRAS) || '{}'); } catch { return {}; }
}

function rememberNote(id: string, extra: NoteExtra) {
  const all = readNoteExtras();
  all[id] = { ...all[id], ...extra };
  localStorage.setItem(NOTE_EXTRAS, JSON.stringify(all));
}

export function decorateNote(note: Row): Row {
  const extra = readNoteExtras()[note._id] || {};
  const legacy: Record<string, string> = { white: '#FFF8E7', gray: '#F3F4F6', tint: '#F3E8FF', ink: '#E8EEF9' };
  const color = /^#[0-9a-fA-F]{6}$/.test(note.color || '') ? note.color : legacy[note.color] || extra.color || '#FFF4CC';
  return { ...note, color, reminderTime: clock(note.reminderTime || extra.reminderTime || ''), googleEventId: note.googleEventId || extra.googleEventId || '' };
}

function googleCalendarLink(title: string, body: string, date: string, time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + 30;
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + (total >= 24 * 60 ? 1 : 0)));
  const endDate = next.toISOString().slice(0, 10).replace(/-/g, '');
  const endClock = total % (24 * 60);
  const stamp = (dayKey: string, clockValue: string) => `${dayKey.replace(/-/g, '')}T${clockValue.replace(':', '')}00`;
  const endTime = `${String(Math.floor(endClock / 60)).padStart(2, '0')}:${String(endClock % 60).padStart(2, '0')}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Dark Media reminder',
    dates: `${stamp(date, time)}/${endDate}T${endTime.replace(':', '')}00`,
    details: body || '',
    ctz: 'Asia/Kolkata',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function clock(value?: string) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function kolkataNow() {
  const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const [date, time] = stamp.split(' ');
  return { date, time: clock(time) };
}

function minutesAfter(earlier: string, later: string) {
  const [eh, em] = earlier.split(':').map(Number);
  const [lh, lm] = later.split(':').map(Number);
  return (lh * 60 + lm) - (eh * 60 + em);
}

let alarmAudio: AudioContext | null = null;

function alarmContext() {
  if (!alarmAudio) alarmAudio = new AudioContext();
  if (alarmAudio.state === 'suspended') void alarmAudio.resume();
  return alarmAudio;
}

if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => { alarmContext(); });

function startRingtone() {
  const ctx = alarmContext();
  let stopped = false;
  let timer = 0;
  const ring = () => {
    if (stopped || ctx.state === 'closed') return;
    [523, 659, 784, 1046, 784, 659].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + index * 0.16;
      osc.start(at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
      osc.stop(at + 0.15);
    });
    timer = window.setTimeout(ring, 1100);
  };
  void ctx.resume().then(ring).catch(ring);
  return () => { stopped = true; window.clearTimeout(timer); };
}

export function NoteAlarms() {
  const { can } = useAuth();
  const [alarm, setAlarm] = useState<Row | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!can('notes.view')) return;
    if (!localStorage.getItem('dm-rung-reset')) {
      localStorage.setItem('dm-rung-reset', '1');
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith('dm-rung:')) sessionStorage.removeItem(key);
      }
    }
    let timer = 0;
    const look = () => {
      api.get('/notes').then((response) => {
        const now = kolkataNow();
        const due = (response.data.data as Row[]).map(decorateNote).find((note) => {
          const time = clock(note.reminderTime);
          if (!note.reminderDate || !time || note.reminderDate !== now.date) return false;
          const late = minutesAfter(time, now.time);
          if (late < 0 || late > 15) return false;
          const key = `dm-rung:${note._id}:${note.reminderDate}:${time}`;
          if (sessionStorage.getItem(key)) return false;
          sessionStorage.setItem(key, '1');
          return true;
        });
        if (due) setAlarm((current) => current || due);
      }).catch(() => undefined);
    };
    look();
    timer = window.setInterval(look, 5000);
    return () => window.clearInterval(timer);
  }, [can]);
  useEffect(() => {
    if (!alarm) return;
    stopRef.current?.();
    stopRef.current = startRingtone();
    return () => { stopRef.current?.(); stopRef.current = null; };
  }, [alarm?._id]);
  if (!alarm) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-card" role="alertdialog" aria-label="Reminder">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Reminder</p>
        <h2 className="mt-2 text-xl font-semibold">{alarm.title || 'Note'}</h2>
        <p className="mt-2 text-sm">{alarm.body}</p>
        <p className="mt-3 text-sm text-secondary">{alarm.reminderDate} · {alarm.reminderTime}</p>
        <Button className="mt-5" onClick={() => { stopRef.current?.(); stopRef.current = null; setAlarm(null); }}>Stop alarm</Button>
      </div>
    </div>
  );
}

function clearRung(id: string) {
  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(`dm-rung:${id}:`)) sessionStorage.removeItem(key);
  }
}

export function NotesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [preset, setPreset] = useState<'all' | 'today' | 'week'>('all');
  const form = useForm<Record<string, string>>({ defaultValues: { color: randomLight(), visibility: 'company' } });
  const load = () => api.get('/notes', { params: { q: query || undefined } }).then((response) => setRows((response.data.data as Row[]).map(decorateNote))).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, [query]);
  const visible = rows.filter((note) => {
    const date = String(note.reminderDate || '');
    if (day) return date === day;
    if (month) return date.startsWith(month);
    if (preset === 'today') return date === todayKey();
    if (preset === 'week') {
      const range = weekRange();
      return date >= range.from && date <= range.to;
    }
    return true;
  });
  const blank = { title: '', body: '', color: randomLight(), reminderDate: '', reminderTime: '', visibility: 'company' };
  const openNew = () => { setEditing(null); setError(''); form.reset(blank); setOpen(true); };
  const openEdit = (note: Row) => {
    setEditing(note);
    setError('');
    form.reset({ title: note.title || '', body: note.body || '', color: note.color || randomLight(), reminderDate: note.reminderDate || '', reminderTime: clock(note.reminderTime), visibility: 'company' });
    setOpen(true);
  };
  return (
    <div>
      <PageHeader title="Sticky notes" text="Each note gets a light color. Add a reminder date and time, and an alarm rings when it is due." action={<Button onClick={openNew}>Add note</Button>} />
      <div className="mb-4 space-y-3">
        <TextInput className="w-full sm:max-w-sm" placeholder="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {([['all', 'All'], ['today', 'Today'], ['week', 'This week']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setPreset(id); setDay(''); setMonth(''); }} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${!day && !month && preset === id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{label}</button>
          ))}
          <TextInput className="w-full sm:w-44" type="date" value={day} onChange={(event) => { setDay(event.target.value); setMonth(''); }} placeholder="Day" />
          <input className="h-11 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime sm:w-44 sm:text-sm" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setDay(''); }} aria-label="Month" />
        </div>
      </div>
      {error && !open && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {visible.length === 0 ? <p className="text-sm text-secondary">{day || month || preset !== 'all' ? 'No reminders in this period.' : 'No notes yet.'}</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((note) => (
            <article key={note._id} className="rounded-3xl border border-line p-4 text-ink" style={{ backgroundColor: note.color }}>
              <div className="mb-2 flex justify-between text-xs">
                <span>{note.pinned ? 'Pinned' : 'Note'}</span>
                <span className="flex gap-2">
                  <button className="min-h-11 px-2 text-sm font-semibold" type="button" onClick={() => openEdit(note)}>Edit</button>
                  <button className="min-h-11 px-2 text-sm font-semibold" type="button" onClick={async () => { await api.patch(`/notes/${note._id}`, { pinned: !note.pinned, body: note.body }); load(); }}>{note.pinned ? 'Unpin' : 'Pin'}</button>
                </span>
              </div>
              <h2 className="font-semibold">{note.title}</h2>
              <p className="mt-2 text-sm">{note.body}</p>
              {note.reminderDate && note.reminderTime && <p className="mt-3 text-xs font-semibold">Reminder · {note.reminderDate} · {note.reminderTime} · <a className="underline" href={googleCalendarLink(note.title || '', note.body || '', note.reminderDate, note.reminderTime)} target="_blank" rel="noreferrer">Google Calendar</a></p>}
              <button className="mt-3 min-h-11 text-sm font-semibold" type="button" onClick={async () => { await api.delete(`/notes/${note._id}`); toast('Note deleted'); load(); }}>Delete</button>
            </article>
          ))}
        </div>
      )}
      {open && <Modal title={editing ? 'Edit note' : 'New note'} onClose={() => { setOpen(false); setEditing(null); }}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        const reminderTime = clock(values.reminderTime);
        if ((values.reminderDate && !reminderTime) || (!values.reminderDate && reminderTime)) {
          setError('Choose both a reminder date and a time');
          return;
        }
        alarmContext();
        const payload: Row = { title: values.title, body: values.body, color: values.color, visibility: 'company', reminderDate: values.reminderDate || '', reminderTime };
        const safe = { title: payload.title, body: payload.body, visibility: 'company', reminderDate: payload.reminderDate };
        if (values.reminderDate && reminderTime) window.open(googleCalendarLink(values.title || '', values.body || '', values.reminderDate, reminderTime), '_blank', 'noopener,noreferrer');
        try {
          let saved: Row;
          try {
            saved = (await (editing ? api.patch(`/notes/${editing._id}`, payload) : api.post('/notes', payload))).data.data;
          } catch {
            saved = (await (editing ? api.patch(`/notes/${editing._id}`, safe) : api.post('/notes', safe))).data.data;
          }
          rememberNote(saved._id, { color: values.color, reminderTime });
          if (!editing || editing.reminderDate !== values.reminderDate || clock(editing.reminderTime) !== reminderTime) clearRung(saved._id);
          toast(reminderTime ? 'Google Calendar opened. Click Save there.' : (editing ? 'Note updated' : 'Note added'));
          setOpen(false);
          setEditing(null);
          load();
        } catch (err) { setError(err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError ? err.message : errorMessage(err)); load(); }
      })}>
        <Field label="Title"><TextInput {...form.register('title')} /></Field>
        <Field label="Note"><TextArea {...form.register('body', { required: true })} /></Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-secondary">Color</span>
            <button type="button" className="text-sm font-semibold" onClick={() => form.setValue('color', randomLight())}>Random</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {LIGHT_COLORS.map((color) => (
              <button key={color} type="button" aria-label={color} onClick={() => form.setValue('color', color)} className={`h-9 w-9 rounded-full border ${form.watch('color') === color ? 'border-black ring-2 ring-black' : 'border-line'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
          <input type="hidden" {...form.register('color')} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Reminder date"><TextInput type="date" {...form.register('reminderDate')} /></Field>
          <Field label="Time"><TextInput type="time" {...form.register('reminderTime')} /></Field>
        </div>
        <p className="text-sm text-secondary">Saving a reminder opens Google Calendar with this note, date, and time. Click Save there. Google shows the alert. No extra Google permission is required.</p>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">{editing ? 'Save' : 'Add note'}</Button>
      </form></Modal>}
    </div>
  );
}

export function ReportsPage() {
  const [catalog, setCatalog] = useState<Row[]>([]);
  const [name, setName] = useState('profit-loss');
  const [report, setReport] = useState<Row | null>(null);
  const [preset, setPreset] = useState('this_month');
  useEffect(() => { api.get('/reports').then((response) => setCatalog(response.data.data)); }, []);
  useEffect(() => { api.get(`/reports/${name}`, { params: { preset } }).then((response) => setReport(response.data.data)).catch(() => setReport(null)); }, [name, preset]);
  return (
    <div className="space-y-4">
      <PageHeader title="Reports & analytics" text="Financial reports are calculated from posted journals. Export uses the same rows." action={<div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">{['csv', 'xlsx', 'pdf'].map((format) => <a key={format} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-semibold" href={`/api/reports/${name}?preset=${preset}&format=${format}`}>{format.toUpperCase()}</a>)}</div>} />
      <div className="flex flex-wrap gap-2">
        <Select className="w-full sm:max-w-xs" value={name} onChange={(event) => setName(event.target.value)}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
        <Select className="w-full sm:max-w-[160px]" value={preset} onChange={(event) => setPreset(event.target.value)}><option value="this_month">This month</option><option value="last_month">Last month</option><option value="this_quarter">This quarter</option><option value="this_year">This year</option></Select>
      </div>
      {!report ? <Spinner /> : <Table><thead><tr>{report.columns.map((column: Row) => <Th key={column.key}>{column.header}</Th>)}</tr></thead><tbody>{report.rows.map((row: Row, index: number) => <tr key={index}>{report.columns.map((column: Row) => <Td key={column.key}>{column.money ? <Money paise={row[column.key]} /> : String(row[column.key] ?? '')}</Td>)}</tr>)}</tbody></Table>}
    </div>
  );
}

export function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = () => api.get('/notifications').then((response) => setRows(response.data.data));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHeader title="Notifications" text="Due payments, deadlines, salary, and calendar reminders." action={<Button variant="ghost" onClick={async () => { await api.post('/notifications/read-all'); load(); }}>Mark all read</Button>} />
      <div className="space-y-2">{rows.map((row) => <button key={row._id} className={`block w-full rounded-2xl border border-line px-4 py-3 text-left ${row.unread ? 'bg-tint' : 'bg-card'}`} type="button" onClick={async () => { await api.post(`/notifications/${row._id}/read`); load(); }}><p className="font-semibold">{row.title}</p><p className="text-sm text-secondary">{row.body}</p></button>)}{rows.length === 0 && <p className="text-sm text-secondary">Nothing needs attention.</p>}</div>
    </div>
  );
}

export function SettingsPage() {
  const { user, can, refresh } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<Row | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const form = useForm<Record<string, string>>();
  useEffect(() => {
    api.get('/settings').then((response) => { setSettings(response.data.data); form.reset(response.data.data); }).catch((err) => setError(errorMessage(err)));
    if (can('users.manage')) api.get('/auth/users').then((response) => setUsers(response.data.data)).catch(() => undefined);
  }, [can]);
  if (!settings && !error) return <Spinner />;
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" text="Currency is INR and the default timezone is Asia/Kolkata." />
      {error && <ErrorText>{error}</ErrorText>}
      {settings && <Card><form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(async (values) => { try { await api.patch('/settings', values); toast('Settings saved'); } catch (err) { setError(errorMessage(err)); } })}>
        {['companyName', 'legalName', 'email', 'phone', 'website', 'address', 'gstin', 'invoicePrefix', 'workStart'].map((field) => <Field key={field} label={field}><TextInput {...form.register(field)} /></Field>)}
        <Field label="Financial year starts"><Select {...form.register('financialYearStartMonth')}><option value="4">April</option><option value="1">January</option></Select></Field>
        {can('settings.manage') && <Button type="submit">Save company</Button>}
      </form></Card>}
      <Card>
        <h2 className="mb-3 font-semibold">Your Theme</h2>
        {/* <h2 className="mb-3 font-semibold">Your theme</h2> */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{(['light', 'dark', 'system'] as const).map((theme) => <Button key={theme} className="w-full" variant="ghost" onClick={async () => { applyTheme(theme); await api.patch('/auth/me', { theme }); toast('Theme saved'); refresh(); }}>{theme}</Button>)}</div>
      </Card>
      
    </div>
  );
}

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
