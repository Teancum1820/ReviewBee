import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usernameFromUser } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

export default function Layout() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      const fallbackUsername = usernameFromUser(data.user);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();

      setUsername(profile?.display_name || fallbackUsername);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="ReviewBee dashboard">
          <span className="brand-mark">RB</span>
          <span>ReviewBee</span>
        </NavLink>
        <nav className="nav-links" aria-label="Main navigation">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/submit">Submit</NavLink>
          <NavLink to="/review">Review Queue</NavLink>
          <NavLink to="/inbox">Inbox</NavLink>
        </nav>
        <div className="account-strip">
          <span title={username}>{username}</span>
          <button className="button button-ghost" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Version 1.1</span>
        <span>Created by Caleb Day</span>
      </footer>
    </div>
  );
}
