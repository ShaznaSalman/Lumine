import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, loginGuest } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError("Hmm, that didn't work. Try again 🌙");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestAccess = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginGuest();
      navigate('/');
    } catch (err) {
      setError('Unable to enter as guest right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF6FF] px-6 py-10 text-[#2C2C2A]">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-[#E9E3FF] text-6xl shadow-soft">
            ✨
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-[#7F77DD]" style={{ fontFamily: 'Nunito, sans-serif' }}>
            Lumine
          </h1>
          <p className="mt-3 text-sm text-[#6D6B6F]">your luminous little world ✨</p>
        </div>

        <div className="w-full rounded-3xl border border-[#E9E3F4] bg-white p-8 shadow-md">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="mb-3 block text-sm font-semibold">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="shinebright"
                className="w-full rounded-2xl border border-[#E9E3F4] bg-[#FBF7FF] px-5 py-3 text-[#2C2C2A] outline-none transition focus:border-[#7F77DD] focus:ring-2 focus:ring-[#E4DBFF]"
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-2xl border border-[#E9E3F4] bg-[#FBF7FF] px-5 py-3 text-[#2C2C2A] outline-none transition focus:border-[#7F77DD] focus:ring-2 focus:ring-[#E4DBFF]"
              />
            </div>

            {error && (
              <div className="rounded-full border border-[#F0D5DA] bg-[#FBEAF0] px-4 py-3 text-sm text-[#B93F62]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#7F77DD] px-5 py-3 text-white transition hover:bg-[#6D68CC] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <circle cx="12" cy="12" r="9" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 1-9 9" />
                </svg>
              ) : null}
              <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>

          <button
            type="button"
            onClick={handleGuestAccess}
            disabled={submitting}
            className="mt-4 w-full rounded-full border border-[#7F77DD] bg-white px-5 py-3 text-[#7F77DD] transition hover:bg-[#F4F0FF] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
