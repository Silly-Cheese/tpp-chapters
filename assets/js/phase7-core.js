import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db, authPersistenceReady } from "./firebase.js";

export { auth, db, onAuthStateChanged, signOut, authPersistenceReady, collection, doc, serverTimestamp, setDoc };
export const app = document.querySelector("#app");
export const ADMIN_ROLES = new Set(["owner","chapterAdmin","complianceAdmin","supportAgent"]);
export const CHAPTER_MANAGERS = new Set(["owner","chapterAdmin","complianceAdmin"]);
export const ACCESS_MANAGERS = new Set(["owner","chapterAdmin"]);
export const CONCERN_MANAGERS = new Set(["owner","chapterAdmin","supportAgent"]);
export const CHAPTER_ACCOUNT_ROLES = new Set(["director","adviser","chapterUser"]);
export const ROUTES = new Set(["/admin","/admin/dashboard","/admin/chapters","/admin/chapter","/admin/users","/admin/memberships","/admin/registry","/admin/concerns","/admin/audit","/admin/settings"]);
export const ROLE_LABELS = {owner:"Owner",chapterAdmin:"Chapter Administrator",complianceAdmin:"Compliance Administrator",supportAgent:"Support Agent",director:"Chapter Director",adviser:"Chapter Adviser",chapterUser:"Chapter User"};
export const ACCOUNT_LABELS = {active:"Active",pending:"Pending",disabled:"Disabled",suspended:"Suspended"};
export const AUTH_LABELS = {active:"Active — Officially Approved",conditional:"Conditionally Approved",inactive:"Temporarily Inactive",suspended:"Suspended",expired:"Expired",closed:"Closed",revoked:"Authorization Revoked",under_review:"Under Review"};
export const STANDING_LABELS = {good_standing:"Good Standing",action_required:"Action Required",under_review:"Under Review",probationary:"Probationary Standing",not_in_good_standing:"Not in Good Standing"};
export const CONCERN_LABELS = {new:"New",in_review:"In Review",resolved:"Resolved",dismissed:"Dismissed"};
export const ACTIVE_SUBMISSIONS = new Set(["submitted","under_review","changes_requested"]);
export const ACTIVE_TICKETS = new Set(["open","awaiting_staff","awaiting_chapter","under_review","escalated"]);
export const state = {authReady:false,user:null,profile:null,chapters:[],publicChapters:[],users:[],memberships:[],concerns:[],auditLogs:[],submissions:[],tickets:[],settings:null,loading:false,error:null,rendering:false,mobileOpen:false};

export const icons = {
 dashboard:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
 chapters:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg>`,
 users:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>`,
 registry:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v5c0 5.25 3.4 8.94 8 10 4.6-1.06 8-4.75 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
 alert:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 21h20zM12 9v5m0 3h.01"/></svg>`,
 audit:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4zM8 9h8M8 13h5M8 17h8"/></svg>`,
 settings:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/></svg>`,
 menu:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
 logout:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5m5 5H3m11-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>`,
 download:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></svg>`,
 plus:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>`,
 refresh:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M17.9 15A7 7 0 0 1 6 18l-2-5"/></svg>`
};

export function route(){const p=(location.hash.replace(/^#/,"")||"/").split("?")[0];return (p.startsWith("/")?p:`/${p}`).replace(/\/+$/,"")||"/";}
export function params(){const r=location.hash.replace(/^#/,"");return new URLSearchParams(r.includes("?")?r.split("?").slice(1).join("?"):"");}
export function go(path){location.hash=path.startsWith("/")?path:`/${path}`;}
export function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
export function title(v=""){return String(v).replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,c=>c.toUpperCase());}
export function toDate(v){if(!v)return null;if(typeof v.toDate==="function")return v.toDate();const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
export function fmt(v,time=false,fallback="Not recorded"){const d=toDate(v);return d?new Intl.DateTimeFormat("en-US",time?{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}:{month:"short",day:"numeric",year:"numeric"}).format(d):fallback;}
export function dateValue(v){const d=toDate(v);if(!d)return "";return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
export function inputDate(v){return v?new Date(`${v}T12:00:00`):null;}
export function roleLabel(v){return ROLE_LABELS[v]||title(v||"Unknown role");}
export function currentRole(){return state.profile?.systemRole||"";}
export function isOwner(){return currentRole()==="owner";}
export function canChapter(){return CHAPTER_MANAGERS.has(currentRole());}
export function canAccess(){return ACCESS_MANAGERS.has(currentRole());}
export function canConcern(){return CONCERN_MANAGERS.has(currentRole());}
export function tone(v){return ["active","good_standing","resolved","approved","complete"].includes(v)?"success":["revoked","closed","disabled","suspended","not_in_good_standing","denied","dismissed"].includes(v)?"danger":["conditional","action_required","probationary","under_review","in_review","pending","changes_requested","escalated"].includes(v)?"warning":"info";}
export function badge(v,label=title(v||"Unknown")){return `<span class="p7-badge p7-${tone(v)}">${esc(label)}</span>`;}
export function mapPublic(){return new Map(state.publicChapters.map(x=>[x.chapterId||x.id,x]));}
export function mapUsers(){return new Map(state.users.map(x=>[x.id,x]));}
export function matches(item,fields,q){q=String(q||"").trim().toLowerCase();return !q||fields.some(f=>String(item[f]||"").toLowerCase().includes(q));}
export function initials(v="TP"){const p=String(v).trim().split(/\s+/).filter(Boolean);return (p.length>1?`${p[0][0]}${p.at(-1)[0]}`:p[0]?.slice(0,2)||"TP").toUpperCase();}
export function heading(k,t,d,a=""){return `<header class="p7-page-heading"><div><p class="p7-kicker">${esc(k)}</p><h1>${esc(t)}</h1><p>${esc(d)}</p></div>${a?`<div class="p7-heading-actions">${a}</div>`:""}</header>`;}
export function alertBox(type,h,p){return `<div class="p7-alert p7-alert-${type}"><div>${icons.alert}</div><div><strong>${esc(h)}</strong><p>${esc(p)}</p></div></div>`;}
export function toast(h,p="",type="success"){const r=document.querySelector("#p7-toast-region");if(!r)return;const e=document.createElement("div");e.className=`p7-toast p7-toast-${type}`;e.innerHTML=`<strong>${esc(h)}</strong>${p?`<span>${esc(p)}</span>`:""}`;r.append(e);setTimeout(()=>e.remove(),4300);}
export function setAlert(id,type,h,p){const e=document.querySelector(`#${id}`);if(e)e.innerHTML=alertBox(type,h,p);}

function link(path,icon,label){const active=route()===path||(path==="/admin/dashboard"&&route()==="/admin");return `<a class="p7-nav-link ${active?"active":""}" href="#${path}">${icon}<span>${esc(label)}</span></a>`;}
export function layout(content,titleText="Administration"){
 const name=state.profile?.displayName||state.user?.email||"Administrator";
 return `<div class="p7-shell" data-phase7-root><aside class="p7-sidebar ${state.mobileOpen?"open":""}"><div class="p7-sidebar-brand"><a class="p7-brand" href="#/admin/dashboard"><img src="assets/brand-mark.svg" alt=""><span><strong>The Prayer Project</strong><small>Administration Console</small></span></a></div><nav class="p7-nav"><span class="p7-nav-label">Management</span>${link("/admin/dashboard",icons.dashboard,"Dashboard")}${link("/admin/chapters",icons.chapters,"Chapters")}${link("/admin/users",icons.users,"Users")}${link("/admin/memberships",icons.users,"Memberships")}${link("/admin/registry",icons.registry,"Public registry")}${link("/admin/concerns",icons.alert,"Concern reports")}${link("/admin/audit",icons.audit,"Audit history")}${link("/admin/settings",icons.settings,"System settings")}<span class="p7-nav-label">Specialist workspaces</span><a class="p7-nav-link" href="#/admin/invitations">${icons.plus}<span>Account invitations</span></a><a class="p7-nav-link" href="#/admin/chapter-workspaces">${icons.chapters}<span>Workspace setup</span></a><a class="p7-nav-link" href="#/admin/submissions">${icons.audit}<span>Submission review</span></a><a class="p7-nav-link" href="#/admin/support">${icons.alert}<span>Support queue</span></a><a class="p7-nav-link" href="#/admin/communications">${icons.registry}<span>Notice publishing</span></a></nav><div class="p7-sidebar-user"><div>${esc(initials(name))}</div><span><strong>${esc(name)}</strong><small>${esc(roleLabel(currentRole()))}</small></span></div></aside><div class="p7-main"><header class="p7-topbar"><button class="p7-icon-button p7-menu-button" data-p7="menu">${icons.menu}</button><div><span>Prayer Project Administration</span><strong>${esc(titleText)}</strong></div><div class="p7-topbar-actions"><button class="btn btn-secondary btn-small" data-p7="refresh">${icons.refresh} Refresh</button><button class="p7-icon-button" data-p7="logout">${icons.logout}</button></div></header><main class="p7-content" id="main-content">${content}</main></div><button class="p7-scrim ${state.mobileOpen?"show":""}" data-p7="close-menu"></button><div class="toast-region" id="p7-toast-region"></div></div>`;
}
export function gate(msg){return `<main class="p7-gate" data-phase7-root><section><img src="assets/brand-mark.svg" alt=""><p class="p7-kicker">Administration</p><h1>Access unavailable.</h1><p>${esc(msg)}</p><a class="btn btn-primary" href="#/dashboard">Return to dashboard</a></section></main>`;}
export function loading(){return `<main class="p7-loading" data-phase7-root><img src="assets/brand-mark.svg" alt=""><div class="spinner"></div><strong>Loading administration…</strong></main>`;}

async function safe(loader){try{const s=await loader();return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.warn(e);state.error=e;return[];}}
export async function loadProfile(user){state.profile=null;if(!user)return;const s=await getDoc(doc(db,"systemUsers",user.uid));if(s.exists())state.profile={id:s.id,...s.data()};}
export async function loadAll(render=true){if(!state.user||!ADMIN_ROLES.has(currentRole()))return;state.loading=true;state.error=null;if(render)window.dispatchEvent(new CustomEvent("p7-render",{detail:{prepare:false}}));const [chapters,publicChapters,users,memberships,concerns,auditLogs,submissions,tickets,settings]=await Promise.all([safe(()=>getDocs(collection(db,"chapters"))),safe(()=>getDocs(query(collection(db,"publicChapterRegistry"),where("isPublished","==",true)))),safe(()=>getDocs(collection(db,"systemUsers"))),safe(()=>getDocs(collection(db,"chapterMemberships"))),safe(()=>getDocs(collection(db,"unauthorizedChapterReports"))),safe(()=>getDocs(query(collection(db,"auditLogs"),orderBy("createdAt","desc"),limit(300)))),safe(()=>getDocs(collection(db,"chapterSubmissions"))),safe(()=>getDocs(collection(db,"supportTickets"))),getDoc(doc(db,"systemSettings","portal")).catch(()=>null)]);state.chapters=chapters.sort((a,b)=>String(a.officialName||a.id).localeCompare(String(b.officialName||b.id)));state.publicChapters=publicChapters;state.users=users.sort((a,b)=>String(a.displayName||a.email).localeCompare(String(b.displayName||b.email)));state.memberships=memberships;state.concerns=concerns.sort((a,b)=>(toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0));state.auditLogs=auditLogs;state.submissions=submissions;state.tickets=tickets;state.settings=settings?.exists?.()?{id:settings.id,...settings.data()}:null;state.loading=false;if(render)window.dispatchEvent(new CustomEvent("p7-render",{detail:{prepare:false}}));}
export async function audit(action,targetType,targetId,summary){await setDoc(doc(collection(db,"auditLogs")),{actorUid:state.user.uid,action,targetType,targetId,summary,createdAt:serverTimestamp()});}
export function csv(name,headers,rows){const q=v=>/[",\n]/.test(String(v??""))?`"${String(v??"").replaceAll('"','""')}"`:String(v??"");const url=URL.createObjectURL(new Blob([[headers,...rows].map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`${name}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);}
