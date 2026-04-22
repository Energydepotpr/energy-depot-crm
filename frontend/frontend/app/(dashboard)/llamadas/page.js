'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../lib/api';
import { useLang } from '../../../lib/lang-context';
import { t } from '../../../lib/lang';

const STATUS_LABEL = {
  completed:     { label: 'Completada',    color: '#10b981' },
  'no-answer':   { label: 'Sin respuesta', color: '#f59e0b' },
  busy:          { label: 'Ocupado',       color: '#f59e0b' },
  failed:        { label: 'Fallida',       color: '#ef4444' },
  initiated:     { label: 'Iniciada',      color: '#1b9af5' },
  ringing:       { label: 'Timbrando',     color: '#1b9af5' },
  'in-progress': { label: 'En curso',      color: '#10b981' },
  canceled:      { label: 'Cancelada',     color: '#4b5563' },
};

function formatDuration(secs) {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function tiempoRelativo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── Audio player inline ───────────────────────────────────────────────────────
function RecordingPlayer({ logId, onDeleted }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.callRecording(logId)
      .then(data => {
        if (!cancelled) {
          // Use proxy URL to avoid browser auth dialog with embedded Twilio credentials
          const sid = data.recording_sid;
          setUrl(sid ? api.recordingAudioUrl(sid) : data.recording_url);
          setLoading(false);
        }
      })
      .catch(err => { if (!cancelled) { setError(err.message || 'Error cargando grabación'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [logId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteRecording(logId);
      onDeleted && onDeleted();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: '#4b5563', fontSize: 12 }}>
      <div style={{ width: 12, height: 12, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Cargando grabación...
    </div>
  );

  if (error) return (
    <div style={{ color: '#ef4444', fontSize: 12, padding: '6px 0' }}>{error}</div>
  );

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
      <audio
        ref={audioRef}
        controls
        src={url}
        style={{ width: '100%', height: 32, accentColor: '#1b9af5' }}
      >
        Tu navegador no soporta audio HTML5.
      </audio>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#f59e0b' }}>¿Eliminar grabación?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#fff', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ background: 'transparent', border: '1px solid #2a3156', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#4b5563', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Fila de log con player expandible ────────────────────────────────────────
function LogRow({ log, onRecordingDeleted, lang }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_LABEL[log.status] || { label: log.status, color: '#4b5563' };
  const hasRecording = !!(log.recording_url || log.recording_sid);

  return (
    <>
      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Número */}
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${st.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="13" height="13" fill="none" stroke={st.color} strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
              </svg>
            </div>
            <div>
              <div style={{ color: '#111827', fontSize: 13, fontWeight: log.lead_name ? 600 : 400 }}>
                {log.lead_name || log.to_number || '—'}
              </div>
              {log.lead_name && log.to_number && (
                <div style={{ color: '#6b7280', fontSize: 11 }}>{log.to_number}</div>
              )}
            </div>
          </div>
        </td>

        {/* Agente */}
        <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: 13 }}>{log.agent_name || '—'}</td>

        {/* Estado */}
        <td style={{ padding: '12px 16px' }}>
          <span style={{ background: `${st.color}15`, color: st.color, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
            {t('calls.status.' + log.status, lang)}
          </span>
        </td>

        {/* Duración */}
        <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: 13 }}>{formatDuration(log.duration)}</td>

        {/* Fecha */}
        <td style={{ padding: '12px 16px', color: '#4b5563', fontSize: 12 }}>
          {new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </td>

        {/* Lead */}
        <td style={{ padding: '12px 16px', fontSize: 12 }}>
          {log.lead_id ? (
            <a href={`/leads?open=${log.lead_id}`} style={{ color: '#1b9af5', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.25)', fontSize: 11, fontWeight: 600, display: 'inline-block' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
            >
              👤 Ver lead
            </a>
          ) : '—'}
        </td>

        {/* Grabación */}
        <td style={{ padding: '12px 16px' }}>
          {hasRecording ? (
            <button
              onClick={() => setExpanded(p => !p)}
              title={expanded ? 'Cerrar player' : 'Reproducir grabación'}
              style={{
                background: expanded ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${expanded ? '#1b9af5' : 'rgba(59,130,246,0.25)'}`,
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: '#1b9af5',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {expanded ? (
                <>
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                  Cerrar
                </>
              ) : (
                <>
                  <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Play
                </>
              )}
            </button>
          ) : (
            <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>
          )}
        </td>
      </tr>

      {/* Fila expandida con player de audio */}
      {expanded && hasRecording && (
        <tr style={{ background: 'rgba(59,130,246,0.03)' }}>
          <td colSpan={7} style={{ padding: '0 16px 12px 16px' }}>
            <RecordingPlayer
              logId={log.id}
              onDeleted={() => {
                setExpanded(false);
                onRecordingDeleted && onRecordingDeleted(log.id);
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Panel de transcripción con chat scrolleable ───────────────────────────────
function TranscriptionPanel({ data }) {
  const [showEn, setShowEn] = useState(false);
  if (data.error) return <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>Error: {data.error}</div>;

  const hasSpeakers = data.speakers?.length > 0;

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          💬 {hasSpeakers ? `Conversación (${data.speakers.length} turnos)` : 'Transcripción'}
        </span>
        {data.translation && (
          <button onClick={() => setShowEn(v => !v)}
            style={{ fontSize: 11, background: showEn ? '#1b9af525' : 'transparent', border: '1px solid #1b9af540', borderRadius: 6, padding: '3px 10px', color: '#60a5fa', cursor: 'pointer' }}>
            {showEn ? '🇵🇷 Español' : '🇺🇸 English'}
          </button>
        )}
      </div>

      {/* Scrollable chat box — same box, content swaps with toggle */}
      <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 8px', background: '#141928', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}>
        {(() => {
          const turns = showEn ? (data.speakers_en || data.speakers) : data.speakers;
          if (turns?.length) {
            return turns.map((turn, i) => {
              const isAgent = turn.speaker === 'Agente' || turn.speaker === 'Agent';
              const isUnknown = turn.speaker === 'Desconocido' || turn.speaker === 'Unknown';
              const bubbleBg = isUnknown ? '#2a2f45' : isAgent ? '#1e3a5f' : '#143d28';
              const bubbleBorder = isUnknown ? '#3a4060' : isAgent ? '#2d5a8e' : '#1a5c38';
              const labelColor = isUnknown ? '#374151' : isAgent ? '#60a5fa' : '#34d399';
              const label = isUnknown ? '❓ Desconocido' : isAgent ? '🎧 Agente' : '👤 Cliente';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUnknown ? 'flex-start' : isAgent ? 'flex-start' : 'flex-end', padding: '0 4px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                  <div style={{ maxWidth: '90%', background: bubbleBg, color: '#f0f4ff', borderRadius: isAgent || isUnknown ? '4px 14px 14px 14px' : '14px 4px 14px 14px', padding: '8px 12px', fontSize: 13, lineHeight: 1.6, border: `1px solid ${bubbleBorder}` }}>
                    {turn.text}
                  </div>
                </div>
              );
            });
          }
          const displayText = showEn && data.translation ? data.translation : data.transcription;
          return displayText
            ? <div style={{ padding: '8px 12px', fontSize: 13, color: '#e8edf8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{displayText}</div>
            : <div style={{ padding: '8px 12px', fontSize: 13, color: '#4b5563', fontStyle: 'italic' }}>Sin contenido transcribible en esta grabación.</div>;
        })()}
      </div>
    </div>
  );
}

// ── Grabaciones Twilio (voicemails + llamadas) ────────────────────────────────
function TwilioRecordingsTab() {
  const [recordings, setRecordings]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [playing, setPlaying]         = useState(null);
  const [transcribing, setTranscribing] = useState({});
  const [transcriptions, setTranscriptions] = useState({});
  const audioRef = useRef(null);

  useEffect(() => {
    api.twilioRecordings()
      .then(r => setRecordings(r.recordings || []))
      .catch(() => setRecordings([]))
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = (sid) => {
    if (playing === sid) { audioRef.current?.pause(); setPlaying(null); }
    else setPlaying(sid);
  };

  const handleTranscribe = async (sid) => {
    setTranscribing(p => ({ ...p, [sid]: true }));
    try {
      const r = await api.transcribeRecording(sid, false);
      setTranscriptions(p => ({ ...p, [sid]: r }));
    } catch (e) {
      setTranscriptions(p => ({ ...p, [sid]: { error: e.message } }));
    } finally {
      setTranscribing(p => ({ ...p, [sid]: false }));
    }
  };

  const sourceLabel = (src) => {
    if (src === 'RecordVerb') return { label: 'Voicemail', color: '#8b5cf6' };
    if (src === 'DialVerb')   return { label: 'Llamada',   color: '#10b981' };
    return { label: src || 'Grabación', color: '#4b5563' };
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#4b5563', gap: 10 }}>
      <div style={{ width: 16, height: 16, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Cargando grabaciones...
    </div>
  );

  if (recordings.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#4b5563', fontSize: 14 }}>Sin grabaciones en Twilio</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {recordings.map(r => {
        const src   = sourceLabel(r.source);
        const isVm  = r.source === 'RecordVerb';
        const audioUrl = api.recordingAudioUrl(r.sid);
        return (
          <div key={r.sid} style={{ background: isVm ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isVm ? 'rgba(139,92,246,0.35)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Type badge */}
              <span style={{ background: src.color + '20', color: src.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                {isVm ? '📩 ' : '📞 '}{src.label}
              </span>
              {/* Phone number — for voicemails show caller (from), for outbound show destination (to) */}
              {(r.from_number || r.to_number) && (
                <span style={{ fontSize: 13, color: '#111827', fontWeight: 600, letterSpacing: '0.02em' }}>
                  📱 {isVm ? (r.from_number || r.to_number) : (r.to_number || r.from_number)}
                </span>
              )}
              {/* Lead name */}
              {r.lead_name && (
                <a href={`/leads?open=${r.lead_id}`} style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.25)', whiteSpace: 'nowrap' }}>
                  👤 {r.lead_name}
                </a>
              )}
              {!r.lead_name && (r.from_number || r.to_number) && (
                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Sin lead vinculado</span>
              )}
              {/* Duration */}
              <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>
                {formatDuration(r.duration)}
              </span>
              {/* Date */}
              <span style={{ fontSize: 12, color: '#4b5563' }}>
                {new Date(r.date_created).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {/* Channels */}
              <span style={{ fontSize: 11, color: '#4b5563' }}>{r.channels === 2 ? 'Estéreo' : 'Mono'}</span>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Play button */}
              <button onClick={() => handlePlay(r.sid)}
                style={{ background: playing === r.sid ? '#1b9af520' : '#1b9af510', border: '1px solid #1b9af540', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#1b9af5', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                {playing === r.sid ? '⏸ Pausar' : '▶ Reproducir'}
              </button>

              {/* Transcribe button */}
              <button onClick={() => handleTranscribe(r.sid)} disabled={transcribing[r.sid]}
                style={{ background: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#f59e0b', cursor: transcribing[r.sid] ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', opacity: transcribing[r.sid] ? 0.7 : 1 }}>
                {transcribing[r.sid]
                  ? <><div style={{ width: 10, height: 10, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Procesando...</>
                  : '✍ Transcribir'}
              </button>

              {/* Download button */}
              <a href={audioUrl} download={`grabacion-${r.sid}.mp3`}
                style={{ background: '#10b98110', border: '1px solid #10b98140', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#10b981', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                ⬇ Descargar
              </a>
            </div>

            {/* Audio player */}
            {playing === r.sid && (
              <div style={{ marginTop: 12 }}>
                <audio ref={audioRef} src={audioUrl} controls autoPlay onEnded={() => setPlaying(null)}
                  style={{ width: '100%', height: 36, borderRadius: 8 }} />
              </div>
            )}

            {/* Transcription result */}
            {transcriptions[r.sid] && (
              <TranscriptionPanel data={transcriptions[r.sid]} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LlamadasPage() {
  const { lang } = useLang();
  const [tab, setTab]           = useState('llamadas');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroGrabacion, setFiltroGrabacion] = useState('todos');

  const cargar = useCallback(() => {
    api.callLogs('').then(setLogs).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    setLoading(false);
    const timer = setInterval(cargar, 20000);
    return () => clearInterval(timer);
  }, [cargar]);

  // Cuando se elimina una grabación, limpiar del estado local
  const handleRecordingDeleted = useCallback((id) => {
    setLogs(prev => prev.map(l =>
      l.id === id ? { ...l, recording_url: null, recording_sid: null } : l
    ));
  }, []);

  const filtrados = logs.filter(l => {
    const matchSearch = !search ||
      l.to_number?.includes(search) ||
      l.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.lead_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || l.status === filtroStatus;
    const matchRec =
      filtroGrabacion === 'todos' ||
      (filtroGrabacion === 'con' && (l.recording_url || l.recording_sid)) ||
      (filtroGrabacion === 'sin' && !l.recording_url && !l.recording_sid);
    return matchSearch && matchStatus && matchRec;
  });

  const totalDuration = filtrados.reduce((sum, l) => sum + (l.duration || 0), 0);
  const completadas   = filtrados.filter(l => l.status === 'completed').length;
  const conGrabacion  = logs.filter(l => l.recording_url || l.recording_sid).length;

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>{t('calls.title', lang)}</h1>
        <p style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>
          {loading ? t('common.loading', lang) : `${filtrados.length} ${t('calls.title', lang).toLowerCase()} · ${completadas} ${t('calls.stat.completed', lang).toLowerCase()} · ${formatDuration(totalDuration)} ${t('calls.stat.duration', lang).toLowerCase()}`}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 0 }}>
        {[{ key: 'llamadas', label: t('calls.tab.logs', lang) }, { key: 'grabaciones', label: t('calls.tab.twilio', lang) }].map(tab_ => (
          <button key={tab_.key} onClick={() => setTab(tab_.key)}
            style={{ background: 'none', border: 'none', padding: '10px 18px', fontSize: 13, fontWeight: tab === tab_.key ? 700 : 400, color: tab === tab_.key ? '#1b9af5' : '#374151', cursor: 'pointer', borderBottom: tab === tab_.key ? '2px solid #1b9af5' : '2px solid transparent', marginBottom: -1, transition: 'color 0.15s' }}>
            {tab_.label}
          </button>
        ))}
      </div>

      {tab === 'grabaciones' && <TwilioRecordingsTab />}
      {tab !== 'grabaciones' && <>


      {/* Stats cards */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: t('calls.stat.total', lang),       value: logs.length,                                                   color: '#1b9af5' },
            { label: t('calls.stat.completed', lang),   value: logs.filter(l => l.status === 'completed').length,             color: '#10b981' },
            { label: t('calls.stat.noAnswer', lang),    value: logs.filter(l => l.status === 'no-answer').length,             color: '#f59e0b' },
            { label: t('calls.stat.recordings', lang),  value: conGrabacion,                                                  color: '#8b5cf6' },
            { label: t('calls.stat.duration', lang),    value: formatDuration(logs.reduce((s, l) => s + (l.duration || 0), 0)), color: '#1b9af5' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={t('calls.filter.number', lang)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none' }}
        />
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none' }}
        >
          <option value="todos">{t('calls.filter.allStatus', lang)}</option>
          {Object.entries(STATUS_LABEL).map(([k]) => (
            <option key={k} value={k}>{t('calls.status.' + k, lang)}</option>
          ))}
        </select>
        <select
          value={filtroGrabacion}
          onChange={e => setFiltroGrabacion(e.target.value)}
          style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none' }}
        >
          <option value="todos">{t('calls.filter.allRec', lang)}</option>
          <option value="con">{t('calls.filter.withRec', lang)}</option>
          <option value="sin">{t('calls.filter.noRec', lang)}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48, gap: 10, color: '#4b5563', fontSize: 14 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #1b9af5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {t('common.loading', lang)}
          </div>
        )}
        {!loading && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#4b5563', fontSize: 14 }}>
            {t('calls.empty', lang)}
          </div>
        )}
        {!loading && filtrados.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                {[t('calls.col.number',lang), t('calls.col.agent',lang), t('calls.col.status',lang), t('calls.col.duration',lang), t('calls.col.date',lang), t('calls.col.lead',lang), t('calls.col.recording',lang)].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  lang={lang}
                  onRecordingDeleted={handleRecordingDeleted}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>}
    </div>
  );
}
