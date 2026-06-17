import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usernameFromUser } from "../lib/auth";
import { NOTIFICATION_COUNTER_UPDATED } from "../lib/notificationEvents";
import { supabase } from "../lib/supabaseClient";

export default function Layout() {
  const [username, setUsername] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const refreshUserSummary = useCallback(async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      setUsername("");
      setUnreadNotificationCount(0);
      return;
    }

    const fallbackUsername = usernameFromUser(data.user);
    const [profileResponse, unreadResponse] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .eq("is_read", false),
    ]);

    setUsername(profileResponse.data?.display_name || fallbackUsername);
    setUnreadNotificationCount(unreadResponse.count ?? 0);
  }, []);

  useEffect(() => {
    refreshUserSummary();
  }, [refreshUserSummary, location.pathname]);

  useEffect(() => {
    window.addEventListener(NOTIFICATION_COUNTER_UPDATED, refreshUserSummary);

    return () => {
      window.removeEventListener(NOTIFICATION_COUNTER_UPDATED, refreshUserSummary);
    };
  }, [refreshUserSummary]);

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
          <NavLink to="/inbox" className="nav-link-with-badge">
            <span>Inbox</span>
            {unreadNotificationCount > 0 ? (
              <span className="nav-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            ) : null}
          </NavLink>
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
