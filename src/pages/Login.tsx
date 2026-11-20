import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstallChoices } from '@/components/InstallApp';
import { Button, ErrorText } from '@/components/ui';
import { useAuth } from '@/context';
import { api, errorMessage, saveSession } from '@/lib/api';

type AuthConfig = { loginEmail: string; google: boolean; googleClientId?: string; otp?: boolean; lanHost?: string };

type GoogleTokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            hint?: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: { message?: string; type?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const companyEmail = 'darkmediatech4@gmail.com';

function loadGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google sign-in did not load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in did not load.'));
    document.head.appendChild(script);
  });
}

function requestGoogleAccessToken(clientId: string, hint: string) {
  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      hint,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error('Google sign-in was cancelled.'));
      },
      error_callback: (error) => reject(new Error(error.message || 'Google sign-in was cancelled.')),
    });
    if (!client) {
      reject(new Error('Google sign-in did not load.'));
      return;
    }
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="mr-2 h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [lanHost, setLanHost] = useState('');
  const [step, setStep] = useState<'choose' | 'code'>('choose');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const email = config?.loginEmail || companyEmail;

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => {
    api.get('/auth/config').then((response) => {
      const data = response.data.data as AuthConfig;
      setConfig(data);
      if (data.lanHost) setLanHost(data.lanHost);
    }).catch(() => setConfig(null));
  }, []);

  async function google() {
    setBusy(true);
    setError('');
    try {
      const clientId = config?.googleClientId;
      if (!clientId) throw new Error('Google sign-in is not ready. Add the Google client id, then restart the API.');
      await loadGoogle();
      const accessToken = await requestGoogleAccessToken(clientId, email);
      const response = await api.post('/auth/google', { accessToken });
      saveSession(response.data.token);
      setUser(response.data.data);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err) === 'Something went wrong. Try again.' && err instanceof Error ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/auth/otp/request', { email });
      setStep('code');
      setCode('');
      setNotice(`A 6-digit code is on its way to ${email}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from Gmail.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/auth/otp/verify', { email, code });
      saveSession(response.data.token);
      setUser(response.data.data);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-black text-white lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between px-8 py-10 sm:px-14 sm:py-14 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-sm font-bold text-black">DM</span>
          <p className="text-sm tracking-[0.22em]">DARK MEDIA ERP</p>
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sign in to the company books.</h1>
          <p className="mt-5 text-base leading-7 text-neutral-400">Only the company Gmail can open Dark Media ERP. Sign in with Google, or with a code sent to that inbox.</p>
        </div>
        <p className="text-xs text-neutral-500">Sajeel · Shakeeb · Ismail</p>
      </section>

      <section className="flex min-h-dvh items-center bg-[#F7F7F7] px-4 py-8 text-black sm:px-12 sm:py-12" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-9">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-sm font-bold text-lime">DM</span>
            <p className="text-sm font-semibold tracking-[0.18em]">DARK MEDIA ERP</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">Dark Media ERP</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-[#737373]">Only this Gmail can continue. Any other Google account is refused.</p>

          <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">Company Gmail</p>
            <p className="mt-1 break-all text-sm font-semibold">{email}</p>
          </div>

          {step === 'choose' ? (
            <div className="mt-6 space-y-3">
              <Button className="h-11 w-full" disabled={busy} onClick={google}>
                <GoogleMark />
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-[#A3A3A3]">
                <span className="h-px flex-1 bg-[#E5E5E5]" />
                or
                <span className="h-px flex-1 bg-[#E5E5E5]" />
              </div>
              <Button className="h-11 w-full" variant="ghost" disabled={busy} onClick={sendCode}>Email a code to this Gmail</Button>
              {notice && <p className="text-sm text-[#3F6212]">{notice}</p>}
            </div>
          ) : (
            <form className="mt-6 space-y-3" onSubmit={verifyCode}>
              <p className="text-sm text-[#737373]">{notice || `Enter the 6-digit code sent to ${email}.`}</p>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#737373]">Code from Gmail</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92E622]"
                />
              </label>
              <Button className="h-11 w-full" disabled={busy} type="submit">Sign in</Button>
              <button type="button" className="w-full text-sm font-semibold text-[#737373]" disabled={busy} onClick={() => { setStep('choose'); setCode(''); setError(''); }}>Back</button>
            </form>
          )}

          {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}
          <InstallChoices host={lanHost} />
        </div>
      </section>
    </div>
  );
}
