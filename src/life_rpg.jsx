import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as recharts from "recharts";
import { createClient } from "@supabase/supabase-js";
const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } = recharts;

const APP_PW = (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_PASSWORD) || "lockintwin";

// ─── SUPABASE ───
const SB_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";
const SB_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";
const supabase = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

// ─── DEFAULT GOALS ───
const DEFAULT_GOALS = [
  { id: "g1", name: "Pelvic Floor", cat: "Body", schedule: "daily", xp: 15 },
  { id: "g2", name: "Workout", cat: "Body", schedule: "daily", xp: 25 },
  { id: "g3", name: "8hr Sleep", cat: "Body", schedule: "daily", xp: 20 },
  { id: "g4", name: "Eat Healthy", cat: "Body", schedule: "daily", xp: 20 },
  { id: "g5", name: "Cleanser", cat: "Face", schedule: "daily", xp: 10 },
  { id: "g6", name: "Moisturize", cat: "Face", schedule: "daily", xp: 10 },
  { id: "g7", name: "Shave", cat: "Face", schedule: "weekly", days: [1, 3, 5], xp: 10 },
  { id: "g8", name: "Jade Roll", cat: "Face", schedule: "weekly", days: [0, 2, 4, 6], xp: 10 },
  { id: "g9", name: "Gua Sha", cat: "Face", schedule: "weekly", days: [0, 2, 4, 6], xp: 10 },
  { id: "g10", name: "Meditate", cat: "Mind", schedule: "daily", xp: 20 },
  { id: "g11", name: "No Phone on Toilet", cat: "Discipline", schedule: "daily", xp: 15 },
  { id: "g12", name: "10min Walk No Screen", cat: "Discipline", schedule: "daily", xp: 15 },
  { id: "g13", name: "No Fap", cat: "Discipline", schedule: "daily", xp: 25 },
  { id: "g14", name: "No Reels", cat: "Discipline", schedule: "daily", xp: 20 },
  { id: "g15", name: "6hr Pomodoros", cat: "Career", schedule: "daily", xp: 30 },
  { id: "g16", name: "LinkedIn Post", cat: "Career", schedule: "weekly", days: [1, 2, 3, 4, 5], xp: 20 },
  { id: "g17", name: "Max Out Connects", cat: "Career", schedule: "weekly", days: [1, 3, 5], xp: 25 },
  { id: "g18", name: "Check Emails", cat: "Career", schedule: "daily", xp: 10 },
];

const CAT_COLORS = { Body: "#ef4444", Face: "#f59e0b", Mind: "#3b82f6", Discipline: "#a855f7", Career: "#22c55e" };
const CATS_ORDER = ["Body", "Face", "Mind", "Discipline", "Career"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LEVELS = [
  { lv: 1, t: "NPC", c: "#555", stats: "Bench 135 · Squat 135 · Skinny fat", who: "95% of people who 'start Monday'" },
  { lv: 3, t: "Awakened", c: "#888", stats: "Bench 155 · Squat 155 · 150lb", who: "You right now · gym beginners" },
  { lv: 8, t: "Locked In", c: "#f59e0b", stats: "Bench 185 · Squat 225 · 160lb", who: "Top 20% college guys · D1 walk-ons" },
  { lv: 15, t: "Sigma", c: "#3b82f6", stats: "Bench 225 · Squat 275 · 165lb lean", who: "Goggins at 19 · top consulting interns" },
  { lv: 25, t: "Demon Mode", c: "#22c55e", stats: "Bench 275 · Squat 315+ · 175lb", who: "Pre-fame Hormozi · top 1% of class" },
  { lv: 40, t: "Final Boss", c: "#f59e0b", stats: "Bench 315 · Squat 405 · 180 shredded", who: "Alex Hormozi · young Chamath" },
  { lv: 60, t: "Ascended", c: "#ef4444", stats: "Bench 365+ · Squat 500+ · 185+ lean", who: "Prime Goggins · Jocko Willink" },
];
const getLevel = (lv) => { let r = LEVELS[0]; for (const l of LEVELS) if (lv >= l.lv) r = l; return r; };
const XP_LV = 150;

// ─── UTILS ───
const dk = (d) => (d || new Date()).toISOString().slice(0, 10);
const today = () => dk();
const uid = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// ─── STORAGE: localStorage + Supabase cloud sync ───
const SK = "lrpg6";

async function cloudGet() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("app_state").select("data").eq("id", "main").single();
    if (error || !data) return null;
    return data.data;
  } catch { return null; }
}

async function cloudSet(v) {
  if (!supabase) return;
  try {
    await supabase.from("app_state").upsert({ id: "main", data: v, updated_at: new Date().toISOString() });
  } catch {}
}

async function sGet() {
  // Try cloud first, fall back to localStorage
  const cloud = await cloudGet();
  if (cloud) {
    // Also update localStorage as cache
    try { localStorage.setItem(SK, JSON.stringify(cloud)); } catch {}
    return cloud;
  }
  try { return JSON.parse(localStorage.getItem(SK)); } catch { return null; }
}

async function sSet(v) {
  try { localStorage.setItem(SK, JSON.stringify(v)); } catch {}
  cloudSet(v); // fire and forget
}

const INIT = { completed: {}, streaks: {}, totalXP: 0, level: 1, heatmap: {}, goals: DEFAULT_GOALS };

function isActiveOn(goal, dow) {
  if (goal.schedule === "daily") return true;
  return goal.days?.includes(dow) ?? false;
}
function goalsForDay(goals, dateObj) {
  const dow = dateObj.getDay();
  return goals.filter(g => isActiveOn(g, dow));
}

// ─── LOCK ───
function Lock({ onUnlock }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(false);
  useEffect(() => { try { if (localStorage.getItem("lrpg-auth") === "ok") onUnlock(); } catch {} }, []);
  const go = () => { if (pw === APP_PW) { try { localStorage.setItem("lrpg-auth", "ok"); } catch {} onUnlock(); } else { setErr(true); setTimeout(() => setErr(false), 1500); } };
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#0c0c10", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 14 }}>⚡</div>
        <div style={{ fontSize: 10, letterSpacing: 5, color: "#333", marginBottom: 4 }}>LIFE RPG</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Praj Kesireddy</div>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="password" autoFocus
          style={{ width: 200, padding: "9px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${err ? "#ef4444" : "#222"}`, borderRadius: 8, color: "#fff", fontSize: 13, fontFamily: "'DM Mono',monospace", textAlign: "center", letterSpacing: 2 }} />
        <div style={{ marginTop: 10 }}><button onClick={go} style={{ padding: "7px 32px", background: "#fff", border: "none", borderRadius: 7, color: "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Enter</button></div>
        {err && <div style={{ color: "#ef4444", fontSize: 10, marginTop: 6 }}>wrong password</div>}
        {supabase && <div style={{ fontSize: 8, color: "#1a3a1a", marginTop: 16 }}>☁️ cloud sync active</div>}
      </div>
    </div>
  );
}

// ─── GOAL EDITOR MODAL ───
function GoalEditor({ goals, onSave, onClose }) {
  const [g, setG] = useState(JSON.parse(JSON.stringify(goals)));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("Body");
  const [newSched, setNewSched] = useState("daily");
  const [newDays, setNewDays] = useState([1, 2, 3, 4, 5]);

  const remove = (id) => setG(g.filter(x => x.id !== id));
  const add = () => {
    if (!newName.trim()) return;
    const goal = { id: uid(), name: newName.trim(), cat: newCat, schedule: newSched, xp: 15 };
    if (newSched === "weekly") goal.days = [...newDays];
    setG([...g, goal]);
    setNewName(""); setAdding(false);
  };

  const cats = {};
  for (const x of g) { if (!cats[x.cat]) cats[x.cat] = []; cats[x.cat].push(x); }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.88)", zIndex: 200 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#141418", border: "1px solid #222", borderRadius: 12, maxWidth: 480, width: "92%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1a1a1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>⚙️ Manage Goals</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAdding(!adding)} style={{ background: adding ? "#222" : "#22c55e", border: "none", borderRadius: 6, padding: "5px 14px", color: adding ? "#888" : "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
              {adding ? "Cancel" : "+ Add Goal"}
            </button>
          </div>
        </div>

        {adding && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #1a1a1e", background: "rgba(255,255,255,0.02)" }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Goal name" onKeyDown={e => e.key === "Enter" && add()}
              style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #222", borderRadius: 6, color: "#fff", fontSize: 12, fontFamily: "'DM Sans',sans-serif", marginBottom: 8 }} autoFocus />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={newCat} onChange={e => setNewCat(e.target.value)}
                style={{ padding: "5px 8px", background: "#1a1a1e", border: "1px solid #222", borderRadius: 5, color: "#ccc", fontSize: 11 }}>
                {CATS_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={newSched} onChange={e => setNewSched(e.target.value)}
                style={{ padding: "5px 8px", background: "#1a1a1e", border: "1px solid #222", borderRadius: 5, color: "#ccc", fontSize: 11 }}>
                <option value="daily">Every day</option>
                <option value="weekly">Specific days</option>
              </select>
              {newSched === "weekly" && (
                <div style={{ display: "flex", gap: 3 }}>
                  {DAY_SHORT.map((d, i) => (
                    <div key={i} onClick={() => setNewDays(newDays.includes(i) ? newDays.filter(x => x !== i) : [...newDays, i].sort())}
                      style={{ width: 22, height: 22, borderRadius: 4, background: newDays.includes(i) ? "#22c55e" : "#1a1a1e", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: newDays.includes(i) ? "#000" : "#555", cursor: "pointer" }}>
                      {d}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={add} style={{ padding: "5px 16px", background: "#22c55e", border: "none", borderRadius: 5, color: "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Add</button>
            </div>
          </div>
        )}

        <div style={{ overflowY: "auto", padding: "8px 20px 16px", flex: 1 }}>
          {CATS_ORDER.filter(c => cats[c]).map(cat => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: CAT_COLORS[cat], marginBottom: 4, fontWeight: 600 }}>{cat.toUpperCase()}</div>
              {cats[cat].map(goal => (
                <div key={goal.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div style={{ width: 4, height: 16, borderRadius: 2, background: CAT_COLORS[goal.cat], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: "#ccc" }}>{goal.name}</span>
                  <span style={{ fontSize: 9, color: "#555", fontFamily: "'DM Mono',monospace" }}>
                    {goal.schedule === "daily" ? "daily" : goal.days?.map(d => DAY_SHORT[d]).join(" ")}
                  </span>
                  <button onClick={() => remove(goal.id)}
                    style={{ background: "none", border: "1px solid #222", borderRadius: 4, padding: "2px 8px", color: "#555", fontSize: 10, cursor: "pointer" }}
                    onMouseEnter={e => { e.target.style.borderColor = "#ef4444"; e.target.style.color = "#ef4444"; }}
                    onMouseLeave={e => { e.target.style.borderColor = "#222"; e.target.style.color = "#555"; }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a1e", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "7px 20px", background: "none", border: "1px solid #222", borderRadius: 6, color: "#888", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSave(g)} style={{ padding: "7px 20px", background: "#fff", border: "none", borderRadius: 6, color: "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIVITY LOG MODAL ───
function ActivityLog({ state, goals, onClose }) {
  const [page, setPage] = useState(0);
  const DAYS_PER_PAGE = 14;

  const logDays = useMemo(() => {
    const days = [];
    // Go back up to 365 days
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dk(d);
      const dayGoals = goalsForDay(goals, d);
      const completed = dayGoals.filter(g => state.completed?.[key]?.[g.id]);
      if (completed.length > 0 || i < 7) {
        days.push({ key, date: d, dayGoals, completed, total: dayGoals.length });
      }
    }
    return days;
  }, [state, goals]);

  const pageDays = logDays.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE);
  const totalPages = Math.ceil(logDays.length / DAYS_PER_PAGE);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.88)", zIndex: 200 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#141418", border: "1px solid #222", borderRadius: 12, maxWidth: 520, width: "92%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1a1a1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>📋 Activity Log</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              style={{ background: "none", border: "1px solid #222", borderRadius: 4, padding: "3px 8px", color: page === 0 ? "#222" : "#888", fontSize: 10, cursor: "pointer" }}>←</button>
            <span style={{ fontSize: 9, color: "#444", fontFamily: "'DM Mono',monospace" }}>{page + 1}/{totalPages || 1}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              style={{ background: "none", border: "1px solid #222", borderRadius: 4, padding: "3px 8px", color: page >= totalPages - 1 ? "#222" : "#888", fontSize: 10, cursor: "pointer" }}>→</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 20px 16px", flex: 1 }}>
          {pageDays.map(day => {
            const pct = day.total > 0 ? Math.round((day.completed.length / day.total) * 100) : 0;
            const dateLabel = day.key === today() ? "Today" : `${DAY_NAMES[day.date.getDay()]}, ${MONTH_SHORT[day.date.getMonth()]} ${day.date.getDate()}`;
            return (
              <div key={day.key} style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(255,255,255,0.015)", borderRadius: 7, border: "1px solid #1a1a1e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#ccc" }}>{dateLabel}</span>
                    <span style={{ fontSize: 9, color: "#333", fontFamily: "'DM Mono',monospace" }}>{day.key}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: pct === 100 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>{pct}%</span>
                    <span style={{ fontSize: 9, color: "#444", fontFamily: "'DM Mono',monospace" }}>{day.completed.length}/{day.total}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {day.dayGoals.map(g => {
                    const done = day.completed.some(c => c.id === g.id);
                    return (
                      <span key={g.id} style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 3,
                        background: done ? CAT_COLORS[g.cat] + "22" : "rgba(255,255,255,0.02)",
                        color: done ? CAT_COLORS[g.cat] : "#2a2a2e",
                        border: `1px solid ${done ? CAT_COLORS[g.cat] + "44" : "#1a1a1e"}`,
                        textDecoration: done ? "none" : "line-through",
                      }}>{g.name}</span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {pageDays.length === 0 && <div style={{ color: "#333", fontSize: 11, padding: 20, textAlign: "center" }}>No activity yet</div>}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a1e", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 20px", background: "#fff", border: "none", borderRadius: 6, color: "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── RECOMPUTE STREAKS FROM COMPLETION DATA ───
function recomputeStreaks(completed, goals) {
  const streaks = {};
  for (const goal of goals) {
    let current = 0, best = 0, i = 0;
    // Walk backwards from today
    while (i < 365) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dk(d);
      if (completed?.[key]?.[goal.id]) {
        current++;
        if (current > best) best = current;
      } else {
        // If it's today and not done yet, don't break the streak — skip
        if (i === 0) { i++; continue; }
        // If this goal wasn't active on this day, skip it
        if (!isActiveOn(goal, d.getDay())) { i++; continue; }
        break;
      }
      i++;
    }
    streaks[goal.id] = { c: current, b: best };
    // Also scan older history for better best streaks
    let run = 0;
    const allDates = Object.keys(completed || {}).sort();
    for (const date of allDates) {
      if (completed[date]?.[goal.id]) { run++; if (run > streaks[goal.id].b) streaks[goal.id].b = run; }
      else {
        const dd = new Date(date + "T00:00:00");
        if (isActiveOn(goal, dd.getDay())) run = 0;
      }
    }
  }
  return streaks;
}

// ─── MAIN ───
function Main() {
  const [s, setS] = useState(INIT);
  const [modal, setModal] = useState(null); // "levels" | "email" | "goals" | "log"
  const [lvUp, setLvUp] = useState(null);
  const [syncStatus, setSyncStatus] = useState(supabase ? "syncing" : "local");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const td = dk(selectedDate);
  const isToday = td === today();

  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    // Don't allow future dates
    if (d > new Date()) return;
    setSelectedDate(d);
  };

  useEffect(() => { (async () => {
    const sv = await sGet();
    if (sv) {
      if (!sv.goals) sv.goals = DEFAULT_GOALS;
      if (sv.lastDay !== today()) sv.combo = 0;
      setS(sv);
    }
    setSyncStatus(supabase ? "synced" : "local");
  })(); }, []);

  const save = async (ns) => { await sSet({ ...ns, lastDay: today() }); };
  const isDone = (id) => s.completed?.[td]?.[id] || false;
  const goals = s.goals || DEFAULT_GOALS;
  const selectedGoals = useMemo(() => goalsForDay(goals, selectedDate), [goals, td]);

  // ─── TOGGLE ───
  const toggle = useCallback((id) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const ns = JSON.parse(JSON.stringify(s));
    if (!ns.completed) ns.completed = {};
    if (!ns.completed[td]) ns.completed[td] = {};

    if (ns.completed[td][id]) {
      delete ns.completed[td][id];
      ns.totalXP = Math.max(0, (ns.totalXP || 0) - goal.xp);
      if (ns.heatmap?.[td]) ns.heatmap[td] = Math.max(0, ns.heatmap[td] - 1);
    } else {
      ns.completed[td][id] = true;
      ns.totalXP = (ns.totalXP || 0) + goal.xp;
      if (!ns.heatmap) ns.heatmap = {};
      ns.heatmap[td] = (ns.heatmap[td] || 0) + 1;

      const nl = Math.floor(ns.totalXP / XP_LV) + 1;
      if (nl > (ns.level || 1)) { setLvUp(nl); setTimeout(() => setLvUp(null), 2200); }
    }

    // Recompute all streaks from actual data
    ns.streaks = recomputeStreaks(ns.completed, goals);
    ns.level = Math.floor((ns.totalXP || 0) / XP_LV) + 1;
    setS(ns); save(ns);
  }, [s, td, goals]);

  // ─── SAVE GOALS ───
  const saveGoals = (newGoals) => {
    const ns = { ...s, goals: newGoals };
    setS(ns); save(ns); setModal(null);
  };

  // ─── COMPUTED ───
  const doneCount = selectedGoals.filter(q => isDone(q.id)).length;
  const totalToday = selectedGoals.length;
  const pct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;
  const xpIn = (s.totalXP || 0) % XP_LV;
  const lv = getLevel(s.level || 1);
  const selDayName = selectedDate.toLocaleDateString("en-US", { weekday: "long" });
  const selDateStr = selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // ─── ACCURACY CHART ───
  const accData = useMemo(() => {
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dk(d);
      const dayGoals = goalsForDay(goals, d);
      const done = dayGoals.filter(q => s.completed?.[key]?.[q.id]).length;
      const total = dayGoals.length;
      const acc = total > 0 ? Math.round((done / total) * 100) : 0;
      bars.push({ label: key === td ? "Today" : d.toLocaleDateString("en-US", { weekday: "narrow" }), acc, done, total, key });
    }
    return bars;
  }, [s, td, goals]);

  // ─── RADAR ───
  const radarData = useMemo(() => {
    return CATS_ORDER.filter(cat => selectedGoals.some(g => g.cat === cat)).map(cat => {
      const catGoals = selectedGoals.filter(g => g.cat === cat);
      const done = catGoals.filter(g => isDone(g.id)).length;
      return { cat, value: catGoals.length > 0 ? Math.round((done / catGoals.length) * 100) : 0 };
    });
  }, [s, td, selectedGoals]);

  // ─── 7-DAY TABLE ───
  const tableDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ key: dk(d), label: i === 0 ? "Today" : DAY_NAMES[d.getDay()], dow: d.getDay() }); }
    return days;
  }, [td]);

  // ─── HEATMAP (GitHub-style, 120 days) ───
  const heat = useMemo(() => {
    const h = [];
    for (let i = 119; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dk(d);
      const dayGoals = goalsForDay(goals, d);
      const done = dayGoals.filter(g => s.completed?.[key]?.[g.id]).length;
      const total = dayGoals.length;
      const pct = total > 0 ? done / total : 0;
      h.push({ k: key, c: done, pct, d, dow: d.getDay() });
    }
    return h;
  }, [s, goals]);

  const heatColor = (pct, count) => {
    if (count === 0) return "rgba(255,255,255,0.03)";
    if (pct >= 0.9) return "#22c55e";
    if (pct >= 0.7) return "#16a34a";
    if (pct >= 0.5) return "#15803d";
    if (pct >= 0.25) return "#166534";
    return "#14532d";
  };

  // ─── HEATMAP WEEKS (columns = weeks, rows = days of week) ───
  const heatWeeks = useMemo(() => {
    const weeks = [];
    let currentWeek = [];
    for (const d of heat) {
      if (d.dow === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(d);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [heat]);

  // ─── MONTH LABELS for heatmap ───
  const heatMonths = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    heatWeeks.forEach((week, wi) => {
      const firstDay = week[0];
      const m = firstDay.d.getMonth();
      if (m !== lastMonth) {
        labels.push({ label: MONTH_SHORT[m], col: wi });
        lastMonth = m;
      }
    });
    return labels;
  }, [heatWeeks]);

  // ─── STREAKS ───
  const topStreaks = useMemo(() => {
    return goals.filter(q => (s.streaks?.[q.id]?.b || 0) > 0).sort((a, b) => (s.streaks?.[b.id]?.b || 0) - (s.streaks?.[a.id]?.b || 0)).slice(0, 5);
  }, [s, goals]);

  // ─── GROUPED ───
  const grouped = useMemo(() => {
    const g = {};
    for (const q of selectedGoals) { if (!g[q.cat]) g[q.cat] = []; g[q.cat].push(q); }
    return g;
  }, [selectedGoals]);

  // ─── HEATMAP TOOLTIP ───
  const [heatTip, setHeatTip] = useState(null);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#0c0c10", color: "#d4d4d4", height: "100vh", overflow: "hidden", display: "grid", gridTemplateRows: "auto 1fr" }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes slideUp{from{transform:translateY(4px);opacity:0}to{transform:translateY(0);opacity:1}}
.qr{transition:background .1s;cursor:pointer;border-radius:5px;padding:4px 6px;margin-bottom:1px;display:flex;align-items:center;gap:7px}
.qr:hover{background:rgba(255,255,255,0.03)}
.heat-dot{transition:transform .1s}
.heat-dot:hover{transform:scale(1.8);z-index:10}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#222;border-radius:3px}::-webkit-scrollbar-track{background:transparent}
.recharts-text{fill:#444!important;font-family:'DM Mono',monospace!important;font-size:9px!important}
      `}</style>

      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>⚡ Praj Kesireddy</span>
          <div onClick={() => setModal("levels")} style={{ padding: "2px 9px", background: "rgba(255,255,255,0.03)", borderRadius: 4, fontSize: 10, color: lv.c, cursor: "pointer", fontWeight: 600 }}>
            Lv {s.level || 1} · {lv.t}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => shiftDate(-1)} style={{ background: "none", border: "1px solid #222", borderRadius: 4, padding: "2px 6px", color: "#888", fontSize: 10, cursor: "pointer", lineHeight: 1 }}>←</button>
            <span style={{ fontSize: 11, color: isToday ? "#333" : "#f59e0b", fontWeight: isToday ? 400 : 600, cursor: "pointer" }} onClick={() => setSelectedDate(new Date())}>{selDayName}, {selDateStr}{!isToday && " *"}</span>
            <button onClick={() => shiftDate(1)} disabled={isToday} style={{ background: "none", border: "1px solid #222", borderRadius: 4, padding: "2px 6px", color: isToday ? "#1a1a1e" : "#888", fontSize: 10, cursor: "pointer", lineHeight: 1 }}>→</button>
          </div>
          {syncStatus === "synced" && <span style={{ fontSize: 8, color: "#166534" }}>☁️</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", fontFamily: "'DM Mono',monospace" }}>{s.totalXP || 0} xp</span>
          <div style={{ width: 48, height: 3, background: "#1a1a1e", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${(xpIn / XP_LV) * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 2, transition: "width .3s" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: pct === 100 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#666" }}>{pct}%</span>
          <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono',monospace" }}>{doneCount}/{totalToday}</span>
          <button onClick={() => setModal("goals")} style={hdrBtn} title="Manage goals">⚙️</button>
          <button onClick={() => setModal("levels")} style={hdrBtn} title="Levels">🏆</button>
          <button onClick={() => setModal("log")} style={hdrBtn} title="Activity log">📋</button>
          <button onClick={() => setModal("email")} style={hdrBtn} title="Email setup">📧</button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 1fr", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT: CHECKLIST */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.04)", padding: "10px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: isToday ? "#333" : "#f59e0b", marginBottom: 8, fontWeight: 600 }}>{isToday ? "TODAY'S QUESTS" : `QUESTS — ${selDateStr.toUpperCase()}`}</div>
          {CATS_ORDER.filter(c => grouped[c]).map(cat => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: CAT_COLORS[cat], marginBottom: 3, fontWeight: 600, opacity: 0.7 }}>{cat.toUpperCase()}</div>
              {grouped[cat].map((q, i) => {
                const d = isDone(q.id);
                const sk = s.streaks?.[q.id]?.c || 0;
                return (
                  <div key={q.id} className="qr" onClick={() => toggle(q.id)} style={{ opacity: d ? 0.4 : 1, animation: `slideUp .1s ease ${i * 20}ms both` }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${d ? CAT_COLORS[cat] : "#262626"}`, background: d ? CAT_COLORS[cat] : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000", fontWeight: 800, flexShrink: 0 }}>{d ? "✓" : ""}</div>
                    <span style={{ fontSize: 11, color: d ? "#444" : "#bbb", textDecoration: d ? "line-through" : "none", flex: 1 }}>{q.name}</span>
                    {sk > 1 && <span style={{ fontSize: 7, color: "#f97316", fontWeight: 600 }}>🔥{sk}</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {totalToday === 0 && <div style={{ color: "#333", fontSize: 11, padding: 20, textAlign: "center" }}>No quests scheduled today. Hit ⚙️ to add goals.</div>}
        </div>

        {/* MID: CHARTS */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.04)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: "1 1 0", minHeight: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 4, fontWeight: 600 }}>14-DAY ACCURACY</div>
            <div style={{ height: "calc(100% - 18px)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accData} barCategoryGap="15%">
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#333", fontSize: 9, fontFamily: "'DM Mono'" }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={20} tick={{ fill: "#222", fontSize: 8 }} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return <div style={{ background: "#1a1a1e", border: "1px solid #262626", borderRadius: 6, padding: "6px 10px", fontSize: 10, color: "#ccc" }}>{d.done}/{d.total} · {d.acc}%</div>;
                  }} />
                  <Bar dataKey="acc" radius={[3, 3, 0, 0]} fill="#22c55e" fillOpacity={0.75} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ flex: "1 1 0", minHeight: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 2, fontWeight: 600 }}>CATEGORY BALANCE</div>
            <div style={{ height: "calc(100% - 14px)" }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%">
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="cat" tick={{ fill: "#555", fontSize: 9, fontFamily: "'DM Sans'" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} strokeWidth={1.5} dot={{ r: 3, fill: "#ef4444" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT: TABLE + HEAT + STREAKS */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 4, fontWeight: 600 }}>7-DAY TRACKER</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "2px 3px", color: "#333", fontWeight: 500, borderBottom: "1px solid #1a1a1e", minWidth: 70 }}>Goal</th>
                    {tableDays.map(d => (
                      <th key={d.key} style={{ textAlign: "center", padding: "2px 1px", color: d.key === td ? "#ccc" : "#333", fontWeight: d.key === td ? 700 : 400, borderBottom: "1px solid #1a1a1e", fontSize: 8 }}>{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goals.map(q => (
                    <tr key={q.id}>
                      <td style={{ padding: "2px 3px", color: "#555", fontSize: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{q.name}</td>
                      {tableDays.map(d => {
                        const active = isActiveOn(q, d.dow);
                        const done = s.completed?.[d.key]?.[q.id];
                        return (
                          <td key={d.key} style={{ textAlign: "center", padding: "1px", lineHeight: 1 }}>
                            {!active ? <span style={{ color: "#151518" }}>·</span>
                              : done ? <span style={{ color: CAT_COLORS[q.cat] || "#22c55e", fontSize: 10 }}>✓</span>
                              : d.key === td ? <span style={{ color: "#2a2a2e" }}>○</span>
                              : <span style={{ color: "#ef444444", fontSize: 8 }}>✗</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GITHUB-STYLE HEATMAP */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", fontWeight: 600 }}>ACTIVITY — 120 DAYS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 7, color: "#333" }}>Less</span>
                {[0, 0.25, 0.5, 0.7, 0.9].map((p, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: heatColor(p, p === 0 ? 0 : 1) }} />
                ))}
                <span style={{ fontSize: 7, color: "#333" }}>More</span>
              </div>
            </div>
            {/* Month labels */}
            <div style={{ display: "flex", gap: 2, marginBottom: 2, paddingLeft: 14 }}>
              {heatMonths.map((m, i) => (
                <div key={i} style={{ position: "relative", left: m.col * 10 - (i > 0 ? heatMonths[i-1].col * 10 + (heatMonths[i-1].label.length * 5) : 0) }}>
                  <span style={{ fontSize: 7, color: "#444", fontFamily: "'DM Mono',monospace" }}>{m.label}</span>
                </div>
              ))}
            </div>
            {/* Grid: rows = days of week (Mon/Wed/Fri labels), cols = weeks */}
            <div style={{ display: "flex", gap: 0 }}>
              {/* Day labels */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 3, justifyContent: "flex-start" }}>
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} style={{ height: 8, display: "flex", alignItems: "center" }}>
                    {i % 2 === 1 ? <span style={{ fontSize: 6, color: "#333", fontFamily: "'DM Mono',monospace", width: 8 }}>{d}</span> : <span style={{ width: 8 }} />}
                  </div>
                ))}
              </div>
              {/* Dots grid */}
              <div style={{ display: "flex", gap: 2, position: "relative" }}>
                {heatWeeks.map((week, wi) => (
                  <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* Pad first week if it doesn't start on Sunday */}
                    {wi === 0 && Array.from({ length: week[0].dow }).map((_, pi) => (
                      <div key={`pad-${pi}`} style={{ width: 8, height: 8 }} />
                    ))}
                    {week.map(d => (
                      <div key={d.k} className="heat-dot"
                        onMouseEnter={() => setHeatTip(d)}
                        onMouseLeave={() => setHeatTip(null)}
                        style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: heatColor(d.pct, d.c),
                          cursor: "pointer", position: "relative",
                        }}
                      />
                    ))}
                  </div>
                ))}
                {/* Tooltip */}
                {heatTip && (
                  <div style={{
                    position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    background: "#1a1a1e", border: "1px solid #333", borderRadius: 6,
                    padding: "6px 10px", fontSize: 9, color: "#ccc", zIndex: 50,
                    pointerEvents: "none", whiteSpace: "nowrap",
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{DAY_NAMES[heatTip.dow]}, {MONTH_SHORT[heatTip.d.getMonth()]} {heatTip.d.getDate()}</div>
                    <div>{heatTip.c} quests · {Math.round(heatTip.pct * 100)}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 3, fontWeight: 600 }}>BEST STREAKS</div>
            {topStreaks.length === 0 && <div style={{ color: "#1a1a1e", fontSize: 9 }}>Complete quests to build streaks</div>}
            {topStreaks.map(q => (
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                <div style={{ width: 3, height: 12, borderRadius: 2, background: CAT_COLORS[q.cat] || "#555" }} />
                <span style={{ fontSize: 10, color: "#666", flex: 1 }}>{q.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316", fontFamily: "'DM Mono',monospace" }}>{s.streaks?.[q.id]?.b || 0}d</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", paddingTop: 4 }}>
            <button onClick={async () => { if (confirm("Reset ALL progress? This cannot be undone.")) { const fresh = { ...INIT, goals }; setS(fresh); await save(fresh); } }}
              style={{ background: "none", border: "1px solid #1a1a1e", color: "#222", padding: "3px 12px", borderRadius: 4, fontSize: 8, cursor: "pointer" }}>Reset Progress</button>
          </div>
        </div>
      </div>

      {/* LEVEL UP */}
      {lvUp && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.85)", zIndex: 100, animation: "fadeIn .2s" }} onClick={() => setLvUp(null)}>
          <div style={{ textAlign: "center", animation: "scaleIn .4s cubic-bezier(.34,1.56,.64,1)" }}>
            <div style={{ fontSize: 44 }}>⚡</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>Level Up</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#fff" }}>{lvUp}</div>
            <div style={{ fontSize: 12, color: getLevel(lvUp).c, marginTop: 2 }}>{getLevel(lvUp).t}</div>
          </div>
        </div>
      )}

      {/* GOAL EDITOR */}
      {modal === "goals" && <GoalEditor goals={goals} onSave={saveGoals} onClose={() => setModal(null)} />}

      {/* ACTIVITY LOG */}
      {modal === "log" && <ActivityLog state={s} goals={goals} onClose={() => setModal(null)} />}

      {/* LEVELS MODAL */}
      {modal === "levels" && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.88)", zIndex: 100 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#141418", border: "1px solid #1e1e22", borderRadius: 12, maxWidth: 500, width: "92%", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid #1a1a1e" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🏆 Level Guide</div>
              <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>6'0" · 145lb · Bench 155 · Squat 140 · 4.0 GPA</div>
            </div>
            <div style={{ overflowY: "auto", padding: "10px 18px 16px", flex: 1 }}>
              {LEVELS.map((lv, i) => {
                const cur = (s.level || 1) >= lv.lv && (i === LEVELS.length - 1 || (s.level || 1) < LEVELS[i + 1].lv);
                return (
                  <div key={lv.lv} style={{ marginBottom: 8, padding: 9, background: cur ? "rgba(255,255,255,0.03)" : "transparent", border: `1px solid ${cur ? lv.c + "33" : "#1a1a1e"}`, borderRadius: 7, position: "relative" }}>
                    {cur && <span style={{ position: "absolute", top: 7, right: 9, fontSize: 8, color: lv.c, fontWeight: 600 }}>← You</span>}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: lv.c, fontFamily: "'DM Mono'" }}>Lv {lv.lv}+</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{lv.t}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#555", lineHeight: 1.3 }}>{lv.stats}</div>
                    <div style={{ fontSize: 8, color: "#333", marginTop: 1 }}>{lv.who}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EMAIL MODAL */}
      {modal === "email" && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.88)", zIndex: 100 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#141418", border: "1px solid #1e1e22", borderRadius: 12, padding: 20, maxWidth: 440, width: "92%" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>📧 Nightly Email</div>
            <div style={{ fontSize: 10, color: "#444", marginBottom: 12 }}>Free · 2 min · runs forever on Google's servers</div>
            <div style={{ background: "#0c0c10", border: "1px solid #1a1a1e", borderRadius: 7, padding: 12, fontSize: 10, color: "#777", lineHeight: 1.7, marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
              1. Go to <span style={{ color: "#3b82f6" }}>script.google.com</span><br />
              2. Paste:<br />
              <div style={{ background: "#08080c", borderRadius: 4, padding: 7, margin: "4px 0", fontSize: 8, fontFamily: "'DM Mono',monospace", color: "#22c55e", whiteSpace: "pre-wrap", overflowX: "auto", lineHeight: 1.4 }}>
{`function sendReminder() {
  var goals = ${JSON.stringify(goals.map(g => g.name))};
  var list = goals.map(function(g) {
    return "• " + g;
  }).join("\\n");
  MailApp.sendEmail({
    to: "prajval.kesireddy@gmail.com",
    subject: "⚡ Did you hit your quests today?",
    body: "Daily Check-in — "
      + new Date().toLocaleDateString()
      + "\\n\\n" + list
      + "\\n\\nDon't break the streak."
  });
}`}
              </div>
              3. Click <strong style={{ color: "#ccc" }}>Run</strong> → authorize<br />
              4. Triggers → Add Trigger → sendReminder · Day timer · 9pm<br />
              5. Done ✓
              <div style={{ marginTop: 8, padding: "6px 8px", background: "rgba(59,130,246,0.06)", borderRadius: 4, fontSize: 9, color: "#3b82f6" }}>
                Tip: The email script auto-includes your current goal list. When you add/remove goals, re-paste the updated code.
              </div>
            </div>
            <button onClick={() => setModal(null)} style={{ width: "100%", padding: "7px", background: "#fff", border: "none", borderRadius: 6, color: "#000", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

const hdrBtn = { background: "none", border: "1px solid #1a1a1e", borderRadius: 4, padding: "3px 7px", color: "#444", fontSize: 10, cursor: "pointer" };

export default function App() {
  const [ok, setOk] = useState(false);
  if (!ok) return <Lock onUnlock={() => setOk(true)} />;
  return <Main />;
}
