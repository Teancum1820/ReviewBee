import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type AuthMode = "login" | "signup";

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "That email and password did not match an account.";
  }

  if (normalized.includes("password")) {
    return message;
  }

  if (normalized.includes("fetch")) {
    return "ReviewBee could not reach Supabase. Check your project URL and anon key.";
  }

  return message || "Something went wrong. Please try again.";
}

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/", { replace: true });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      setError("Add your Supabase URL and anon key to .env.local before signing in.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter an email and password.");
      return;
    }

    setLoading(true);

    const response =
      mode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);

    if (response.error) {
      setError(friendlyAuthError(response.error.message));
      return;
    }

    if (mode === "signup" && !response.data.session) {
      setMessage("Account created. If email confirmation is enabled in Supabase, confirm the account before logging in.");
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">RB</span>
          <div>
            <h1>ReviewBee</h1>
            <p>Review better ads together.</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            Log in
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
          >
            Sign up
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />

          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />

          {error ? <p className="alert alert-error">{error}</p> : null}
          {message ? <p className="alert alert-success">{message}</p> : null}

          <button className="button button-primary button-full" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
