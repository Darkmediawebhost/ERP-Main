import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallChoices({ host }: { host?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setPrompt(null);
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">Install</p>
      <p className="mt-2 text-sm leading-6 text-[#737373]">Install DARK MEDIA ERP on this laptop, or download the Android APK. The phone needs to be on the same Wi-Fi as this laptop, with DARK MEDIA ERP running.</p>
      <div className="mt-3 space-y-2">
        {installed ? (
          <p className="text-sm font-semibold">DARK MEDIA ERP is installed on this laptop.</p>
        ) : prompt ? (
          <Button type="button" className="h-11 w-full" onClick={install}>Install on this laptop</Button>
        ) : (
          <p className="text-sm leading-6 text-[#737373]">On this laptop, open DARK MEDIA ERP in Chrome or Edge, then choose Install app.</p>
        )}
        <a className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#E5E5E5] bg-white text-sm font-semibold" href="/download/demo-erp.apk">Download Android APK</a>
      </div>
      {host && <p className="mt-2 text-xs leading-5 text-[#737373]">The APK connects to this laptop at {host}.</p>}
    </div>
  );
}
