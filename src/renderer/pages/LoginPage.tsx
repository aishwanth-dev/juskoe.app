import React, { useState } from 'react';
import './LoginPage.css';

const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

const LoginPage: React.FC = () => {
    const [step, setStep] = useState<'choose' | 'credentials' | 'otp'>('choose');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    // ---- Email + Password Flow ----
    const handleEmailAuth = async () => {
        if (isSignUp && !name.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!email.trim() || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                // Sign up — creates account, sends OTP for verification
                const result = await ipcRenderer?.invoke('auth:signup', {
                    email: email.trim(),
                    password,
                    name: name.trim(),
                });
                if (result?.success) {
                    if (result.needsVerification) {
                        // Account created, needs email OTP verification
                        setStep('otp');
                    }
                    // If no verification needed, auth state change handles it
                } else {
                    setError(result?.error || 'Sign up failed. Please try again.');
                }
            } else {
                // Sign in — direct password authentication
                const result = await ipcRenderer?.invoke('auth:signin', {
                    email: email.trim(),
                    password,
                });
                if (result?.success) {
                    // Signed in directly — auth state change will handle navigation
                    console.log('[Login] Signed in successfully');
                } else {
                    const errMsg = result?.error || 'Sign in failed';
                    if (errMsg.includes('Invalid login credentials')) {
                        setError('Invalid email or password. If you\'re new, click "Create account" below.');
                    } else {
                        setError(errMsg);
                    }
                }
            }
        } catch (e: any) {
            setError(e.message || 'Authentication error');
        }
        setLoading(false);
    };

    // ---- OTP Verification (after signup) ----
    const handleVerifyOTP = async () => {
        if (!otpCode.trim() || otpCode.length < 6) {
            setError('Please enter the 6-digit code');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const result = await ipcRenderer?.invoke('auth:verify-otp', {
                email: email.trim(),
                token: otpCode.trim(),
            });
            if (result?.success) {
                console.log('[Login] OTP verified — auth state will update');
            } else {
                setError(result?.error || 'Invalid code. Please try again.');
            }
        } catch (e: any) {
            setError(e.message || 'Verification error');
        }
        setLoading(false);
    };

    // ---- Google OAuth ----
    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await ipcRenderer?.invoke('auth:login-google');
            if (!result?.success) {
                setError(result?.error || 'Failed to open Google login');
            }
        } catch (e: any) {
            setError(e.message || 'Google login error');
        }
        setLoading(false);
    };

    // ---- Render ----
    return (
        <div className="login-page">
            <div className="login-card">
                {/* Logo */}
                <img
                    className="login-logo"
                    src="../assets/juskoe_logo.png"
                    alt="Juskoe"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <h1 className="login-title">Welcome to Juskoe</h1>
                <p className="login-subtitle">Sign in to sync your data across devices</p>

                {/* Step 1: Choose method */}
                {step === 'choose' && (
                    <>
                        <button className="login-google-btn" onClick={handleGoogleLogin} disabled={loading}>
                            <svg viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        <div className="login-divider">or</div>

                        <button
                            className="login-submit-btn"
                            onClick={() => setStep('credentials')}
                        >
                            Continue with Email
                        </button>
                    </>
                )}

                {/* Step 2: Email + Password (+ Name for signup) */}
                {step === 'credentials' && (
                    <div className="login-form">
                        {isSignUp && (
                            <input
                                className="login-input"
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                disabled={loading}
                            />
                        )}
                        <input
                            className="login-input"
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus={!isSignUp}
                            disabled={loading}
                        />
                        <input
                            className="login-input"
                            type="password"
                            placeholder={isSignUp ? 'Password (min 6 characters)' : 'Password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                            disabled={loading}
                        />
                        <button
                            className="login-submit-btn"
                            onClick={handleEmailAuth}
                            disabled={loading || !email.trim() || password.length < 6 || (isSignUp && !name.trim())}
                        >
                            {loading
                                ? (isSignUp ? 'Creating account...' : 'Signing in...')
                                : (isSignUp ? 'Create account' : 'Sign in')
                            }
                        </button>
                        <button
                            className="login-toggle-btn"
                            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                        >
                            {isSignUp
                                ? 'Already have an account? Sign in'
                                : "Don't have an account? Create one"
                            }
                        </button>
                        <button className="otp-back-btn" onClick={() => { setStep('choose'); setError(''); setPassword(''); setName(''); }}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 3: OTP verification (after signup) */}
                {step === 'otp' && (
                    <div className="login-form">
                        <p className="otp-info">
                            We sent a verification code to <span className="otp-email">{email}</span>
                        </p>
                        <input
                            className="login-input"
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                            autoFocus
                            maxLength={6}
                            disabled={loading}
                        />
                        <button
                            className="login-submit-btn"
                            onClick={handleVerifyOTP}
                            disabled={loading || otpCode.length < 6}
                        >
                            {loading ? 'Verifying...' : 'Verify & sign in'}
                        </button>
                        <button className="otp-back-btn" onClick={() => { setStep('credentials'); setOtpCode(''); setError(''); }}>
                            ← Back
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && <div className="login-error">{error}</div>}

                {/* Loading */}
                {loading && step === 'choose' && (
                    <div className="login-loading">
                        <div className="login-spinner" />
                        Opening Google sign-in...
                    </div>
                )}


            </div>

            <p className="login-footer">
                By signing in you agree to our Terms of Service
            </p>
        </div>
    );
};

export default LoginPage;
