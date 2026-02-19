import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Ugyldig e-mailadresse.';
    case 'auth/user-disabled':
      return 'Denne konto er deaktiveret.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Forkert e-mail eller adgangskode.';
    case 'auth/email-already-in-use':
      return 'Denne e-mail er allerede i brug.';
    case 'auth/weak-password':
      return 'Adgangskoden skal være mindst 6 tegn.';
    case 'auth/too-many-requests':
      return 'For mange forsøg. Prøv igen senere.';
    case 'auth/network-request-failed':
      return 'Netværksfejl. Tjek din forbindelse.';
    default:
      return 'Login fejlede. Prøv igen.';
  }
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const { signInWithEmail, registerWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setIsRegister(false);
    onOpenChange(false);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !password) return;
    try {
      setBusy(true);
      if (isRegister) {
        await registerWithEmail(email.trim(), password);
        toast.success('Konto oprettet!');
      } else {
        await signInWithEmail(email.trim(), password);
      }
      onOpenChange(false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      toast.error(getErrorMessage(code));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRegister ? 'Opret konto' : 'Log ind'}</DialogTitle>
          <DialogDescription>
            Log ind for at gemme din ferieplan i skyen og synkronisere mellem enheder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="loginEmail">E-mail</Label>
              <Input
                id="loginEmail"
                type="email"
                placeholder="din@email.dk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="loginPassword">Adgangskode</Label>
              <Input
                id="loginPassword"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit(); }}
              />
            </div>
            <Button
              className="w-full cursor-pointer"
              disabled={busy || !email.trim() || !password}
              onClick={handleEmailSubmit}
            >
              {isRegister ? 'Opret konto' : 'Log ind'}
            </Button>
          </div>

          {/* Toggle login/register */}
          <p className="text-xs text-center text-muted-foreground">
            {isRegister ? (
              <>Har du allerede en konto?{' '}
                <button type="button" className="underline cursor-pointer" onClick={() => setIsRegister(false)}>
                  Log ind
                </button>
              </>
            ) : (
              <>Ingen konto?{' '}
                <button type="button" className="underline cursor-pointer" onClick={() => setIsRegister(true)}>
                  Opret konto
                </button>
              </>
            )}
          </p>
        </div>

        <Button variant="outline" onClick={handleClose} className="cursor-pointer">
          Annuller
        </Button>
      </DialogContent>
    </Dialog>
  );
}
