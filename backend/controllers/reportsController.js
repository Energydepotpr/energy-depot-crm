const PDFDocument = require('pdfkit');
const { pool } = require('../services/db');

async function generarReporte(req, res) {
  const period = parseInt(req.query.period) || 30;

  try {
    // 1. Leads by stage (count + sum value)
    const leadsByStage = await pool.query(`
      SELECT ps.name AS etapa, ps.color, COUNT(l.id) AS total, COALESCE(SUM(l.value), 0) AS valor_total
      FROM pipeline_stages ps
      LEFT JOIN leads l ON l.stage_id = ps.id
      GROUP BY ps.id, ps.name, ps.color
      ORDER BY ps.position
    `);

    // 2. Leads created in period
    const leadsCreados = await pool.query(
      `SELECT COUNT(*) AS total FROM leads WHERE created_at >= NOW() - INTERVAL '${period} days'`
    );

    // 3. Messages count in period (inbound vs outbound)
    const mensajes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'inbound')  AS entrantes,
        COUNT(*) FILTER (WHERE direction = 'outbound') AS salientes
      FROM messages
      WHERE created_at >= NOW() - INTERVAL '${period} days'
    `);

    // 4. Top contacts by lead count
    const topContactos = await pool.query(`
      SELECT c.name, COUNT(l.id) AS leads
      FROM contacts c
      JOIN leads l ON l.contact_id = c.id
      GROUP BY c.id, c.name
      ORDER BY leads DESC
      LIMIT 5
    `);

    // 5. Leads won in period
    const leadsGanados = await pool.query(`
      SELECT COUNT(*) AS total, COALESCE(SUM(l.value), 0) AS valor_total
      FROM leads l
      JOIN pipeline_stages ps ON ps.id = l.stage_id
      WHERE ps.name = 'Ganado'
        AND l.updated_at >= NOW() - INTERVAL '${period} days'
    `);

    const totalLeads = leadsByStage.rows.reduce((s, r) => s + parseInt(r.total), 0);
    const leadsNuevos = parseInt(leadsCreados.rows[0]?.total || 0);
    const msgEntrantes = parseInt(mensajes.rows[0]?.entrantes || 0);
    const msgSalientes = parseInt(mensajes.rows[0]?.salientes || 0);
    const ganados = parseInt(leadsGanados.rows[0]?.total || 0);
    const valorGanado = parseFloat(leadsGanados.rows[0]?.valor_total || 0);

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'Reporte CRM Fix A Trip PR' } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-crm-${Date.now()}.pdf"`);
    doc.pipe(res);

    const W = 595.28;
    const H = 841.89;
    const DARK = '#1a3a5c';
    const ACCENT = '#6366f1';
    const LIGHT_BG = '#f1f5f9';
    const WHITE = '#ffffff';
    const TEXT_DARK = '#1e293b';
    const TEXT_MID = '#475569';
    const EMERALD = '#10b981';

    // ── Header band ──
    doc.rect(0, 0, W, 100).fill(DARK);

    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(28).text('Fix A Trip PR', 40, 28);
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(13).text('Reporte CRM', 40, 62);

    // Date range badge
    const now = new Date();
    const from = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const fmt = d => d.toLocaleDateString('es-PR', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateStr = `${fmt(from)} — ${fmt(now)}`;
    doc.fillColor('#bfdbfe').font('Helvetica').fontSize(10).text(dateStr, 40, 82);

    // Period badge on right
    doc.roundedRect(W - 120, 30, 80, 40, 8).fill(ACCENT);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22).text(`${period}d`, W - 120, 37, { width: 80, align: 'center' });
    doc.fillColor('#c7d2fe').font('Helvetica').fontSize(9).text('período', W - 120, 62, { width: 80, align: 'center' });

    // ── Section 1: Resumen General ────────────────────────────────────────────
    let y = 120;
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13).text('Resumen General', 40, y);
    doc.moveTo(40, y + 18).lineTo(W - 40, y + 18).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 28;

    const cards = [
      { label: 'Total Leads', value: totalLeads, color: ACCENT },
      { label: `Leads nuevos (${period}d)`, value: leadsNuevos, color: '#3b82f6' },
      { label: 'Mensajes recibidos', value: msgEntrantes, color: '#8b5cf6' },
      { label: 'Leads ganados', value: ganados, color: EMERALD },
    ];

    const cardW = (W - 80 - 30) / 4;
    cards.forEach((card, i) => {
      const cx = 40 + i * (cardW + 10);
      doc.roundedRect(cx, y, cardW, 72, 6).fill(LIGHT_BG);
      doc.rect(cx, y, 4, 72).fill(card.color);
      doc.fillColor(card.color).font('Helvetica-Bold').fontSize(26)
        .text(card.value.toString(), cx + 12, y + 12, { width: cardW - 16 });
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(9)
        .text(card.label, cx + 12, y + 46, { width: cardW - 16 });
    });

    y += 90;

    // Valor ganado row
    doc.roundedRect(40, y, W - 80, 36, 6).fill('#ecfdf5');
    doc.rect(40, y, 4, 36).fill(EMERALD);
    doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(12)
      .text('Valor total ganado:', 52, y + 11);
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(14)
      .text(`$${valorGanado.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 200, y + 10);
    y += 52;

    // ── Section 2: Leads por Etapa ────────────────────────────────────────────
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13).text('Leads por Etapa', 40, y);
    doc.moveTo(40, y + 18).lineTo(W - 40, y + 18).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 28;

    // Table header
    doc.rect(40, y, W - 80, 24).fill(DARK);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
      .text('ETAPA', 52, y + 8, { width: 200 })
      .text('LEADS', 290, y + 8, { width: 80, align: 'right' })
      .text('VALOR TOTAL', 390, y + 8, { width: W - 430, align: 'right' });

    y += 24;

    leadsByStage.rows.forEach((row, i) => {
      const bg = i % 2 === 0 ? WHITE : LIGHT_BG;
      doc.rect(40, y, W - 80, 22).fill(bg);

      // Stage color dot
      const stageColor = row.color || ACCENT;
      doc.circle(55, y + 11, 5).fill(stageColor);

      doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)
        .text(row.etapa, 68, y + 7, { width: 210 });
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(9)
        .text(parseInt(row.total).toString(), 290, y + 7, { width: 80, align: 'right' });
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(9)
        .text(`$${parseFloat(row.valor_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          390, y + 7, { width: W - 430, align: 'right' });
      y += 22;
    });

    // Table border
    doc.rect(40, y - (leadsByStage.rows.length * 22) - 24, W - 80, (leadsByStage.rows.length * 22) + 24)
      .lineWidth(1).strokeColor('#e2e8f0').stroke();

    y += 20;

    // ── Section 3: Actividad de Mensajes ──────────────────────────────────────
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13).text('Actividad de Mensajes', 40, y);
    doc.moveTo(40, y + 18).lineTo(W - 40, y + 18).lineWidth(1).strokeColor('#e2e8f0').stroke();
    y += 28;

    const msgTotal = msgEntrantes + msgSalientes;
    const halfW = (W - 80 - 10) / 2;

    // Entrantes box
    doc.roundedRect(40, y, halfW, 70, 6).fill(LIGHT_BG);
    doc.rect(40, y, 4, 70).fill(ACCENT);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(30)
      .text(msgEntrantes.toString(), 52, y + 8, { width: halfW - 12 });
    doc.fillColor(TEXT_MID).font('Helvetica').fontSize(10)
      .text('Mensajes entrantes', 52, y + 46, { width: halfW - 12 });
    if (msgTotal > 0) {
      const pct = Math.round((msgEntrantes / msgTotal) * 100);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
        .text(`${pct}% del total`, 52, y + 57, { width: halfW - 12 });
    }

    // Salientes box
    doc.roundedRect(40 + halfW + 10, y, halfW, 70, 6).fill(LIGHT_BG);
    doc.rect(40 + halfW + 10, y, 4, 70).fill(EMERALD);
    doc.fillColor(EMERALD).font('Helvetica-Bold').fontSize(30)
      .text(msgSalientes.toString(), 52 + halfW + 10, y + 8, { width: halfW - 12 });
    doc.fillColor(TEXT_MID).font('Helvetica').fontSize(10)
      .text('Mensajes salientes', 52 + halfW + 10, y + 46, { width: halfW - 12 });
    if (msgTotal > 0) {
      const pct = Math.round((msgSalientes / msgTotal) * 100);
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
        .text(`${pct}% del total`, 52 + halfW + 10, y + 57, { width: halfW - 12 });
    }

    y += 88;

    // Progress bar
    if (msgTotal > 0) {
      const barW = W - 80;
      doc.rect(40, y, barW, 10).roundedRect(40, y, barW, 10, 5).fill('#e2e8f0');
      const inPct = msgEntrantes / msgTotal;
      if (inPct > 0) doc.roundedRect(40, y, barW * inPct, 10, 5).fill(ACCENT);
      y += 18;
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
        .text(`Total: ${msgTotal} mensajes en los últimos ${period} días`, 40, y);
      y += 20;
    }

    // ── Section 4: Top Contactos ──────────────────────────────────────────────
    if (topContactos.rows.length > 0) {
      y += 8;
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(13).text('Top Contactos', 40, y);
      doc.moveTo(40, y + 18).lineTo(W - 40, y + 18).lineWidth(1).strokeColor('#e2e8f0').stroke();
      y += 28;

      topContactos.rows.forEach((row, i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_BG;
        doc.rect(40, y, W - 80, 22).fill(bg);
        doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(9)
          .text(`#${i + 1}`, 48, y + 7, { width: 20 });
        doc.fillColor(TEXT_DARK).font('Helvetica').fontSize(9)
          .text(row.name, 72, y + 7, { width: 300 });
        doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9)
          .text(`${row.leads} lead${row.leads !== '1' ? 's' : ''}`, W - 120, y + 7, { width: 80, align: 'right' });
        y += 22;
      });
      doc.rect(40, y - topContactos.rows.length * 22, W - 80, topContactos.rows.length * 22)
        .lineWidth(1).strokeColor('#e2e8f0').stroke();
      y += 16;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = H - 40;
    doc.rect(0, footerY - 4, W, 44).fill(DARK);
    doc.fillColor('#93c5fd').font('Helvetica').fontSize(9)
      .text(
        `Generado el ${fmt(now)} — CRM Fix A Trip PR`,
        40, footerY + 6,
        { width: W - 80, align: 'center' }
      );

    doc.end();
  } catch (err) {
    console.error('[REPORTS] Error generando PDF:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = { generarReporte };
