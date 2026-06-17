import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Layout() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
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
          <span title={email}>{email}</span>
          <button className="button button-ghost" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
