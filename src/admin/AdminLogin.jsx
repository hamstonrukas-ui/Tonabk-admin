import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErreur("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      return setErreur("Email ou mot de passe incorrect");
    }

    const role = data.user?.app_metadata?.role || data.user?.user_metadata?.role;
    setLoading(false);

    if (role !== "admin") {
      await supabase.auth.signOut();
      return setErreur("Ce compte n'a pas les droits administrateur");
    }

    navigate("/");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F3F3", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={handleLogin} style={{ background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 }}>
        <p style={{ textAlign: "center", fontWeight: 800, fontSize: 18, marginBottom: 16, color: "#1B1B1B" }}>
          Tona<span style={{ color: "#F5720C" }}>Bk</span> Admin
        </p>
        {erreur && <p style={{ color: "#E0342B", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}
        <input
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "10px 12px", fontSize: 14, width: "100%", marginBottom: 10 }}
        />
        <input
          type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required
          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "10px 12px", fontSize: 14, width: "100%", marginBottom: 14 }}
        />
        <button
          type="submit" disabled={loading}
          style={{ width: "100%", background: "#F5720C", color: "#fff", fontWeight: 700, fontSize: 14, borderRadius: 6, padding: "10px 0", border: "none" }}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
