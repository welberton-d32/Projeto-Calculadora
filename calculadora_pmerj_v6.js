/* ===================================================================
   calculadora_pm.js — lógica da Calculadora de Salário da PM
   Vinculado pelo HTML via <script src="calculadora_pm.js"></script>
   Contém: (1) guarda de sessão (gate de login)
           (2) helper de triênios pela data de praça
           (3) cálculo principal (Remuneração Básica/Bruta e descontos)
   =================================================================== */

// ===== (1) Guarda de sessão (gate de login) — via URL =====
// A permissão vem na URL (?acesso=ok), então funciona no duplo clique (file://),
// sem depender de sessionStorage.
// ATENÇÃO: NÃO é segurança real — quem digitar 'calculadora_pmerj.html?acesso=ok'
// entra direto. Trava apenas o acesso casual.
// if (new URLSearchParams(window.location.search).get('acesso') !== 'ok') {
//   window.location.href = 'login.html';
// }

// // Botão "Sair": volta ao login (injetado via JS).
// document.addEventListener('DOMContentLoaded', function () {
//   const sair = document.createElement('button');
//   sair.type = 'button';
//   sair.textContent = 'Sair';
//   sair.className = 'cen-btn';
//   sair.style.cssText = 'position:fixed; top:16px; right:16px; width:auto; ' +
//     'padding:8px 16px; z-index:1000; background:#fff;';
//   sair.addEventListener('click', function () {
//     window.location.href = 'login.html'; // sai: volta ao login (sem o token)
//   });
//   document.body.appendChild(sair);
// });

// ===== Abas de navegação (Ativos <-> Veteranos) =====
document.addEventListener('DOMContentLoaded', function () {
  const token = new URLSearchParams(location.search).get('acesso');
  const q = token ? ('?acesso=' + encodeURIComponent(token)) : '';
  const atual = (location.pathname.split('/').pop() || '').toLowerCase();

  function aba(rotulo, arquivo) {
    const a = document.createElement('a');
    a.textContent = rotulo;
    a.href = arquivo + q;
    const ativa = atual === arquivo.toLowerCase();
    a.style.cssText = 'text-decoration:none; padding:10px 6px; font-size:15px; ' +
      'border-bottom:3px solid transparent; margin-bottom:-1px; ' +
      'transition:color .15s ease, border-color .15s ease; ' +
      (ativa ? 'color:var(--acento); border-bottom-color:var(--acento); font-weight:700;'
             : 'color:#64748b; font-weight:600;');
    if (!ativa) {
      a.addEventListener('mouseenter', function () { a.style.color = 'var(--acento)'; });
      a.addEventListener('mouseleave', function () { a.style.color = '#64748b'; });
    }
    return a;
  }

  const nav = document.createElement('nav');
  nav.style.cssText = 'display:flex; gap:28px; justify-content:center; flex-wrap:wrap; ' +
    'max-width:1040px; margin:0 auto 18px; border-bottom:1px solid var(--borda, #e5e9f0);';
  nav.appendChild(aba('Ativos', 'index.html'));
  nav.appendChild(aba('Veteranos', 'Calculadora_Veterano.html'));

  const wrap = document.querySelector('.wrap');
  const header = wrap ? wrap.querySelector('header') : null;
  if (wrap && header) wrap.insertBefore(nav, header);
  else if (wrap) wrap.insertBefore(nav, wrap.firstChild);
});

// ===== Relatório em PDF (biblioteca jsPDF, carregada sob demanda) =====

// Carrega a jsPDF de um CDN só quando o usuário pede o relatório.
// Precisa de internet na primeira vez (depois o navegador guarda em cache).
function carregarJsPDF(callback) {
  if (window.jspdf && window.jspdf.jsPDF) { callback(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = callback;
  s.onerror = function () {
    alert('Não foi possível carregar a biblioteca de PDF.\nVerifique a conexão com a internet e tente de novo.');
  };
  document.head.appendChild(s);
}

// Lê o texto de um elemento pelo id (troca espaço fixo por espaço normal).
function txtRel(id) {
  const el = document.getElementById(id);
  return el ? el.textContent.replace(/\u00A0/g, ' ').replace(/\u2212/g, '-').trim() : '—';
}

// Lê o texto da opção selecionada de um <select>.
function selRel(id) {
  const el = document.getElementById(id);
  if (!el || !el.selectedOptions || !el.selectedOptions[0]) return '—';
  return el.selectedOptions[0].textContent.trim();
}

// Monta e baixa o PDF com os valores atuais da simulação.
function gerarRelatorioPDF() {
  carregarJsPDF(function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const M = 48;       // margem esquerda
    const DIR = 547;    // margem direita (A4 = 595pt)
    let y = 56;

    // ---- cabeçalho ----
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('Simulação de Remuneração — relatório', M, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), M, y);
    doc.setTextColor(0); y += 22;
    doc.setDrawColor(200); doc.line(M, y, DIR, y); y += 24;

    // helper de linha "rótulo .......... valor"
    function linha(rotulo, valor, opts) {
      opts = opts || {};
      if (y > 800) { doc.addPage(); y = 56; }
      doc.setFont('helvetica', opts.bold ? 'bold' : (opts.muted ? 'italic' : 'normal'));
      doc.setFontSize(opts.big ? 12 : 10);
      if (opts.muted) doc.setTextColor(120);
      doc.text(rotulo, M, y);
      doc.text(valor, DIR, y, { align: 'right' });
      if (opts.muted) doc.setTextColor(0);
      y += opts.big ? 20 : 16;
    }
    function titulo(t) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(t, M, y); y += 18;
    }
    function valorNum(id) {
      const el = document.getElementById(id);
      if (!el) return 0;
      const s = el.textContent.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
      return parseFloat(s) || 0;
    }
    function temValor(id) { return Math.abs(valorNum(id)) > 0.005; }
    function fmtBR(v) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    // sub-entrada (detalhe): menor, cinza e recuada
    function linhaItem(rotulo, valor) {
      if (y > 800) { doc.addPage(); y = 56; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(135);
      doc.text('\u00B7 ' + rotulo, M + 16, y);
      doc.text(valor, DIR, y, { align: 'right' });
      doc.setTextColor(0); y += 13;
    }
    function coletar(sel, selNome, base) {
      let i = 0; const arr = [];
      document.querySelectorAll(sel).forEach(function (inp) {
        const v = parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
        if (v <= 0) return;
        i++;
        let nome = base + ' ' + i;
        if (selNome) {
          const item = inp.closest('.field');
          const ne = item ? item.querySelector(selNome) : null;
          if (ne && ne.value.trim()) nome = ne.value.trim();
        }
        arr.push({ v: v, nome: nome });
      });
      return arr;
    }
    function coletarGrat() {
      const defs = [['gc-subsidio', 'Subsídio / GEE Comando'], ['gc-representacao', 'Verba de Representação'], ['gc-comissao', 'Cargo em Comissão']];
      const arr = [];
      defs.forEach(function (d) {
        const el = document.getElementById(d[0]);
        const v = el ? (parseFloat(String(el.dataset.commit).replace(',', '.')) || 0) : 0;
        if (v > 0) arr.push({ v: v, nome: d[1] });
      });
      return arr;
    }
    // 0 -> linha do grupo (zerada); 1 -> só o item; 2+ -> itens + (total)
    function grupo(itens, rotuloGrupo, sinal, totalId) {
      if (itens.length === 0) {
        return;
      } else if (itens.length === 1) {
        linha(itens[0].nome, sinal + ' ' + fmtBR(itens[0].v));
      } else {
        itens.forEach(function (x) { linhaItem(x.nome, sinal + ' ' + fmtBR(x.v)); });
        linha(rotuloGrupo + ' (total)', txtRel(totalId), { muted: true });
      }
    }

    // ---- parâmetros ----
    titulo('Parâmetros');
    const depEl = document.getElementById('dependentes');
    linha('Posto / Graduação', selRel('posto'));
    linha('Curso de Habilitação Profissional', selRel('habilitacao'));
    linha('Triênio', selRel('trienio'));
    linha('Dependentes', depEl ? (depEl.value || '0') : '0');
    y += 8;

    // ---- composição ----
    titulo('Composição da remuneração');
    linha('Soldo', txtRel('t-soldo'));
    if (temValor('t-dif')) linha('Dif-Posto/Grad', txtRel('t-dif'));
    linha('GRET', txtRel('t-gret'));
    if (temValor('t-ghp')) linha('GHP', txtRel('t-ghp'));
    linha('GRAM (Risco)', txtRel('t-gram'));
    if (temValor('t-trienio')) linha('Triênios', txtRel('t-trienio'));
    if (temValor('t-gee')) linha('GEE - Encargos Especiais', txtRel('t-gee'));
    linha('Remuneração Básica', txtRel('t-rem-basica'), { bold: true });
    y += 6;
    grupo(coletar('.vant-valor', '.vant-nome', 'Vantagem'), 'Outras Vantagens', '+', 't-vant');
    grupo(coletar('.vind-valor', '.vind-nome', 'Verba'), 'Verbas Indenizatórias', '+', 't-vind');
    const gc = coletarGrat();
    if (gc.length > 0) {
      y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Gratificações de Comando', M, y); y += 15; doc.setFont('helvetica', 'normal');
      grupo(gc, 'Grat. de Comando', '+', 't-gratcmd');
    }
    if (temValor('t-abono')) linha('Abono de Permanência', txtRel('t-abono'));
    linha('Remuneração Bruta', txtRel('t-rem-bruta'), { bold: true });
    y += 8; doc.setDrawColor(220); doc.line(M, y, DIR, y); y += 18;

    // ---- descontos ----
    titulo('Descontos');
    linha('Contribuição Militar', txtRel('t-contrib'));
    if (temValor('t-fuspom')) linha('FUSPOM', txtRel('t-fuspom'));
    grupo(coletar('.desc-disc-input', '.desc-disc-nome', 'Desconto'), 'Descontos Discricionários', '-', 't-desc-disc');
    if (temValor('t-irrf')) linha('Imposto de Renda (IRRF)', txtRel('t-irrf'));
    grupo(coletar('.pensao-input', null, 'Pensão'), 'Pensões', '-', 't-pensao');
    if (temValor('t-abate')) linha('Abate-teto', txtRel('t-abate'));
    linha('Total dos Descontos', '- ' + txtRel('r-desc'), { bold: true });
    y += 8; doc.setDrawColor(120); doc.line(M, y, DIR, y); y += 22;

    // ---- líquido ----
    linha('Remuneração Líquida', txtRel('t-liquido'), { bold: true, big: true });

    // ---- cards finais: Rendimento Tributável e Base do IRPF ----
    if (y > 720) { doc.addPage(); y = 56; }
    y += 14;
    const rtVal = parseFloat(document.body.dataset.rendtrib || '0') || 0;
    const biVal = parseFloat(document.body.dataset.baseir || '0') || 0;
    const cW = (DIR - M - 16) / 2;
    const cH = 48;
    function cardResumo(x, rot, val) {
      doc.setDrawColor(205); doc.setFillColor(244, 248, 252);
      doc.roundedRect(x, y, cW, cH, 6, 6, 'FD');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(rot, x + 12, y + 18);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
      doc.text(val, x + 12, y + 37);
      doc.setTextColor(0);
    }
    cardResumo(M, 'Rendimento Tributável', fmtBR(rtVal));
    cardResumo(M + cW + 16, 'Base de Cálculo do IRPF', fmtBR(biVal));
    y += cH + 8;

    // ---- rodapé ----
    y += 28;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Estimativa para conferência. Não substitui o contracheque oficial.', M, y);
    doc.setTextColor(0);

    doc.save('relatorio-simulacao-pm.pdf');
  });
}

// Botões "Gerar relatório (PDF)" e "Limpar" — injetados no card do contracheque.
document.addEventListener('DOMContentLoaded', function () {
  const liq = document.getElementById('t-liquido');
  const alvo = (liq && liq.closest('.card')) || document.body;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:16px; text-align:center;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cen-btn';
  btn.textContent = 'Gerar relatório (PDF)';
  btn.addEventListener('click', gerarRelatorioPDF);
  wrap.appendChild(btn);

  // "Limpar": reinicia a simulação. Recarregar a página é o jeito mais simples
  // e seguro de zerar tudo (campos fixos + campos dinâmicos). O ?acesso=ok
  // permanece na URL, então o gate continua liberado.
  const btnLimpar = document.createElement('button');
  btnLimpar.type = 'button';
  btnLimpar.className = 'cen-btn';
  btnLimpar.textContent = 'Limpar';
  btnLimpar.style.marginLeft = '10px';
  btnLimpar.addEventListener('click', function () {
    window.location.reload();
  });
  wrap.appendChild(btnLimpar);

  alvo.appendChild(wrap);
});

// Move o card de reajustes para logo ACIMA do quadro "breakdown".
document.addEventListener('DOMContentLoaded', function () {
  const reaj = document.getElementById('reajuste');
  const reajCard = reaj ? reaj.closest('.card') : null;
  const bdTable = document.querySelector('table.breakdown');
  const bdCard = bdTable ? bdTable.closest('.card') : null;
  if (reajCard && bdCard && bdCard.parentNode) {
    reajCard.style.gridColumn = '1 / -1'; // ocupa a largura toda, se estiver num grid
    reajCard.style.marginBottom = '0';
    bdCard.parentNode.insertBefore(reajCard, bdCard);
  }
});

// ===== Helper: contagem de triênios pela data de praça =====
document.addEventListener('DOMContentLoaded', function () {
  const MS_DIA = 24 * 60 * 60 * 1000;
  const DIAS_TRIENIO = 1095; // 3 anos, sem considerar bissextos

  const inputData = document.getElementById('data-praca');
  const btn = document.getElementById('btn-trienios');
  const elCount = document.getElementById('trienios-count');
  const elPct = document.getElementById('trienios-pct');

  // Guarda de depuração: avisa no console se algum id não existir
  if (!inputData || !btn || !elCount || !elPct) {
    console.error('Helper de triênios: elemento não encontrado. Confira os id ' +
      'data-praca, btn-trienios, trienios-count, trienios-pct.', {
        inputData: !!inputData, btn: !!btn, elCount: !!elCount, elPct: !!elPct
      });
    return;
  }

  // PROVISÓRIO (a confirmar): 1º triênio = 10%, +5% por triênio, teto 60%
  function percentualSugerido(trienios) {
    if (trienios <= 0) return 0;
    return Math.min(60, 5 + 5 * trienios);
  }

  function calcularTrienios() {
    const valor = inputData.value;
    if (!valor) { elCount.textContent = '—'; elPct.textContent = '—'; return; }

    const dataPraca = new Date(valor + 'T00:00:00');
    const hoje = new Date();
    const dias = Math.floor((hoje - dataPraca) / MS_DIA);

    if (!Number.isFinite(dias) || dias < 0) {
      elCount.textContent = '0'; elPct.textContent = '0%'; return;
    }

    const trienios = Math.floor(dias / DIAS_TRIENIO);
    elCount.textContent = trienios + (trienios === 1 ? ' triênio' : ' triênios');
    elPct.textContent = percentualSugerido(trienios) + '%';
  }

  btn.addEventListener('click', calcularTrienios);
});


// ===== Linhas novas no breakdown: Dif-Posto/Grad, GEE e FUSPOM =====
document.addEventListener('DOMContentLoaded', function () {
  function makeRow(cls, labelHtml, valId, valCls) {
    const tr = document.createElement('tr');
    if (cls) { tr.className = cls; if (cls.indexOf('comp-row') >= 0) tr.style.display = 'none'; }
    const td1 = document.createElement('td');
    td1.className = 'lbl-cell';
    td1.innerHTML = labelHtml;
    const td2 = document.createElement('td');
    if (valCls) td2.className = valCls;
    td2.id = valId;
    td2.innerHTML = (valCls === 'neg' ? '\u2212 R$\u00A00,00' : '+ R$\u00A00,00');
    tr.appendChild(td1);
    tr.appendChild(td2);
    return tr;
  }
  function rowOf(id) { const el = document.getElementById(id); return el ? el.closest('tr') : null; }

  const soldoRow = rowOf('t-soldo');
  if (soldoRow && !document.getElementById('t-dif')) {
    soldoRow.parentNode.insertBefore(makeRow('comp-row', 'Dif-Posto/Grad', 't-dif', 'pos'), soldoRow.nextSibling);
  }
  const trienioRow = rowOf('t-trienio');
  if (trienioRow && !document.getElementById('t-gee')) {
    trienioRow.parentNode.insertBefore(makeRow('comp-row', 'GEE — Encargos Especiais (60%)', 't-gee', 'pos'), trienioRow.nextSibling);
  }
  const contribRow = rowOf('t-contrib');
  if (contribRow && !document.getElementById('t-fuspom')) {
    contribRow.parentNode.insertBefore(
      makeRow('', '(\u2212) FUSPOM (<span id="t-fuspom-p">0</span>%) <span class="badge-aux">fundo de saúde · sobre o soldo</span>', 't-fuspom', 'neg'),
      contribRow.nextSibling);
  }
  const brutaRow = rowOf('t-rem-bruta');
  if (brutaRow && !document.getElementById('t-gratcmd')) {
    brutaRow.parentNode.insertBefore(makeRow('', 'Grat. de Comando PMERJ', 't-gratcmd', 'pos'), brutaRow);
  }
  if (brutaRow && !document.getElementById('t-abono')) {
    brutaRow.parentNode.insertBefore(makeRow('', 'Abono de Permanência', 't-abono', 'pos'), brutaRow);
  }
  const liqRow = rowOf('t-liquido');
  if (liqRow && !document.getElementById('t-abate')) {
    liqRow.parentNode.insertBefore(
      makeRow('', '(−) Abate-teto <span class="badge-aux">limite remuneratório</span>', 't-abate', 'neg'),
      liqRow);
  }
});

// ===== Controle Dif-Posto/Grad: checkbox + seletor de posto substituto (acima do atual) =====
document.addEventListener('DOMContentLoaded', function () {
  const posto = document.getElementById('posto');
  if (!posto) return;
  const fieldPosto = posto.closest('.field') || posto.parentNode;

  const box = document.createElement('div');
  box.style.cssText = 'margin-top:10px;';
  box.innerHTML =
    '<label for="dif-chk" style="display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer;margin:0;">' +
      '<input type="checkbox" id="dif-chk"> Diferença de Posto ou Graduação (Dif-Posto/Grad.)' +
    '</label>' +
    '<div id="dif-wrap" style="display:none;margin-top:8px;">' +
      '<div id="dif-sel-group">' +
        '<label for="dif-posto" style="font-weight:600;display:block;margin-bottom:4px;">Posto/Graduação substituto (acima do atual)</label>' +
        '<select id="dif-posto"></select>' +
      '</div>' +
      '<div id="dif-nota-cel" class="hint" style="display:none; font-size:12px; font-style: italic">Coronel: não há posto acima — a Dif equivale a 20% do próprio soldo.</div>' +
      '<div class="hint" style="margin-top:6px; font-size:12px; font-style: italic">A diferença de soldo entra na base de todas as gratificações e na Remuneração Básica.</div>' +
    '</div>';
  fieldPosto.parentNode.insertBefore(box, fieldPosto.nextSibling);

  const chk = document.getElementById('dif-chk');
  const wrap = document.getElementById('dif-wrap');
  const selDif = document.getElementById('dif-posto');
  const selGroup = document.getElementById('dif-sel-group');
  const notaCel = document.getElementById('dif-nota-cel');

  function popularSubstitutos() {
    const idx = posto.selectedIndex;
    const ehCel = posto.options[idx].textContent.trim() === 'Cel PM';
    // Ativos: Coronel é o último posto e não recebe Dif — esconde a seção inteira.
    box.style.display = ehCel ? 'none' : '';
    if (ehCel) { chk.checked = false; wrap.style.display = 'none'; }
    const anterior = selDif.value;
    selDif.innerHTML = '';
    for (let i = 0; i < idx; i++) {                 // índices menores = postos acima
      const o = posto.options[i];
      const op = document.createElement('option');
      op.value = o.value;
      op.textContent = o.textContent.trim();
      selDif.appendChild(op);
    }
    chk.disabled = false;
    selGroup.style.display = 'block';
    notaCel.style.display = 'none';
    if (anterior) {
      for (let i = 0; i < selDif.options.length; i++) {
        if (selDif.options[i].value === anterior) { selDif.selectedIndex = i; break; }
      }
    }
  }
  function recalcular() { posto.dispatchEvent(new Event('change')); }

  chk.addEventListener('change', function () {
    wrap.style.display = chk.checked ? 'block' : 'none';
    recalcular();
  });
  selDif.addEventListener('change', recalcular);
  posto.addEventListener('change', popularSubstitutos);

  popularSubstitutos();
});

// ===== GEE (Encargos Especiais) — só para Coronel, no card de reajuste =====
document.addEventListener('DOMContentLoaded', function () {
  const posto = document.getElementById('posto');
  const reaj = document.getElementById('reajuste');
  const reajCard = reaj ? reaj.closest('.card') : null;
  if (!posto || !reajCard) return;

  const box = document.createElement('div');
  box.id = 'gee-wrap';
  box.style.cssText = 'display:none;margin-top:12px;padding-top:12px;border-top:1px solid #e7eef6;';
  box.innerHTML =
    '<label for="gee-chk" style="display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer;margin:0;">' +
      '<input type="checkbox" id="gee-chk"> Gratificação de Encargos Especiais — GEE (E-12/790/1994)' +
    '</label>' +
    '<div class="hint" style="margin-top:6px;">Exclusiva de Coronel. Vale 60% de (Soldo + Dif-Posto/Grad + GRET + GHP + GRAM) e integra a Remuneração Básica.</div>';
  reajCard.appendChild(box);

  const chk = document.getElementById('gee-chk');
  function atualizar() {
    const ehCel = posto.options[posto.selectedIndex].textContent.trim() === 'Cel PM';
    box.style.display = ehCel ? 'block' : 'none';
    if (!ehCel && chk.checked) chk.checked = false;
  }
  chk.addEventListener('change', function () { posto.dispatchEvent(new Event('change')); });
  posto.addEventListener('change', atualizar);
  atualizar();
});

// ===== Cálculo principal (em construção) =====
// Etapa atual: Remuneração Básica = Soldo + GRET + GHP + GRAM + Triênio
document.addEventListener('DOMContentLoaded', function () {
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const selPosto = document.getElementById('posto');
  const selHab   = document.getElementById('habilitacao');
  const selTri   = document.getElementById('trienio');
  const selFus   = document.getElementById('fuspom');
  const listaVant = document.getElementById('vant-lista');
  const btnAddVant = document.getElementById('btn-add-vant');
  const listaVind = document.getElementById('vind-lista');
  const btnAddVind = document.getElementById('btn-add-vind');
  const selDep   = document.getElementById('dependentes');
  const listaDesc = document.getElementById('desc-disc-lista');
  const btnAddDesc = document.getElementById('btn-add-desc');
  const listaPensao = document.getElementById('pensao-lista');
  const btnAddPensao = document.getElementById('btn-add-pensao');
  const elDescDiscMax = document.getElementById('desc-disc-max');
  const elDescDiscAviso = document.getElementById('desc-disc-aviso');
  const chkReaj  = document.getElementById('reajuste');
  const chkReaj2 = document.getElementById('reajuste2');
  const chkIsencaoGram = document.getElementById('isencao-gram');

  if (!selPosto || !selHab || !selTri) {
    console.error('Cálculo: elemento não encontrado. Confira os id posto, habilitacao, trienio.');
    return;
  }

  const REAJUSTE1_PCT = 5.62; // 1º reajuste
  const REAJUSTE2_PCT = 5.62; // 2º reajuste, sobre o soldo já reajustado pelo 1º
  const CONTRIB_MIL_PCT = 10.5; // Contribuição Militar (previdência) sobre a Rem. Básica
  const DED_DEP = 189.59; // dedução por dependente no IR
  const MAX_DESCONTOS = 5; // limite de campos discricionários
  const MAX_VANT = 5; // limite de campos de outras vantagens
  const MAX_VIND = 5; // limite de campos de verbas indenizatórias
  const MAX_PENSAO = 5; // limite de campos de pensão

  // escreve em um elemento só se ele existir (robusto durante a construção)
  function set(id, texto) { const el = document.getElementById(id); if (el) el.textContent = texto; }
  // formata percentual no padrão pt-BR (192.5 -> "192,5")
  function pct(n) { return String(n).replace('.', ','); }

  // ---- IRPF 2026 ----
  const DESC_SIMPL = 607.20; // desconto simplificado mensal (substitui Contrib. Militar + dependentes, se maior)
  const faixas = [
    { ate: 2428.80,  aliq: 0,     ded: 0 },
    { ate: 2826.65,  aliq: 0.075, ded: 182.16 },
    { ate: 3751.05,  aliq: 0.15,  ded: 394.16 },
    { ate: 4664.68,  aliq: 0.225, ded: 675.49 },
    { ate: Infinity, aliq: 0.275, ded: 908.73 }
  ];
  function irTabela(base) {
    for (const f of faixas) if (base <= f.ate) return Math.max(0, base * f.aliq - f.ded);
    return 0;
  }
  // redutor 2026: incide sobre o RENDIMENTO TRIBUTÁVEL
  function redutorIR(rendTrib, ir) {
    if (rendTrib <= 5000) return ir;     // reduz tudo -> imposto zero
    if (rendTrib >= 7350) return 0;      // sem redução
    return Math.max(0, Math.min(ir, 978.62 - 0.133145 * rendTrib));
  }

  // habilita/desabilita o botão "Adicionar" conforme o limite de campos
  function atualizarBtnAdd() {
    if (!listaDesc || !btnAddDesc) return;
    const cheio = listaDesc.children.length >= MAX_DESCONTOS;
    btnAddDesc.disabled = cheio;
    btnAddDesc.style.opacity = cheio ? '0.5' : '1';
    btnAddDesc.textContent = cheio ? 'Limite de 5 descontos atingido' : '+ Adicionar desconto';
  }

  // Confirmação dos campos dinâmicos: o valor só entra no cálculo ao clicar "Confirmar".
  function marcarPendente(inp) {
    const item = inp.closest('.field');
    const btn = item ? item.querySelector('.campo-ok') : null;
    if (btn) { btn.style.background = 'var(--acento)'; btn.style.color = '#fff'; }
  }
  function confirmarCampo(btn) {
    const item = btn.closest('.field');
    const inp = item ? item.querySelector('input[type=number]') : null;
    if (inp) inp.dataset.commit = inp.value || '0';
    btn.style.background = ''; btn.style.color = ''; btn.textContent = '\u2713';
    calcular();
  }

  // cria um novo campo de desconto discricionário (se não estourar o limite)
  function criarCampoDesc() {
    if (!listaDesc || listaDesc.children.length >= MAX_DESCONTOS) return;
    const item = document.createElement('div');
    item.className = 'field desc-disc-item';
    item.style.cssText = 'display:flex; gap:8px; align-items:center;';
    item.innerHTML =
      '<input type="text" class="desc-disc-nome" placeholder="Nome do desconto" style="flex:1; padding:10px 12px; border:1.5px solid var(--borda); border-radius:10px; font-size:14px; font-family:inherit; color:var(--texto); background:#fff;">' +
      '<div class="money-row" style="flex:0 0 160px;">' +
        '<span class="money-prefix">R$</span>' +
        '<input type="number" class="desc-disc-input" data-commit="0" value="0" min="0" step="0.01" inputmode="decimal" style="color: var(--vermelho);">' +
      '</div>' +
      '<button type="button" class="cen-btn campo-ok" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Confirmar (efetivar valor)">✓</button>' +
      '<button type="button" class="cen-btn desc-disc-rem" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Remover">×</button>';
    listaDesc.appendChild(item);
    atualizarBtnAdd();
  }

  // habilita/desabilita o botão de adicionar pensão conforme o limite
  function atualizarBtnAddPensao() {
    if (!listaPensao || !btnAddPensao) return;
    const cheio = listaPensao.children.length >= MAX_PENSAO;
    btnAddPensao.disabled = cheio;
    btnAddPensao.style.opacity = cheio ? '0.5' : '1';
    btnAddPensao.textContent = cheio ? 'Limite de 5 pensões atingido' : '+ Adicionar pensão';
  }

  // cria um novo campo de pensão (valor em vermelho), se não estourar o limite
  function criarCampoPensao() {
    if (!listaPensao || listaPensao.children.length >= MAX_PENSAO) return;
    const item = document.createElement('div');
    item.className = 'field pensao-item';
    item.style.cssText = 'display:flex; gap:8px; align-items:center;';
    item.innerHTML =
      '<div class="money-row" style="flex:1;">' +
        '<span class="money-prefix">R$</span>' +
        '<input type="number" class="pensao-input" data-commit="0" value="0" min="0" step="0.01" inputmode="decimal" style="color: var(--vermelho);">' +
      '</div>' +
      '<button type="button" class="cen-btn campo-ok" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Confirmar (efetivar valor)">✓</button>' +
      '<button type="button" class="cen-btn pensao-rem" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Remover">×</button>';
    listaPensao.appendChild(item);
    atualizarBtnAddPensao();
  }

  // habilita/desabilita o botão de adicionar vantagem conforme o limite
  function atualizarBtnAddVant() {
    if (!listaVant || !btnAddVant) return;
    const cheio = listaVant.children.length >= MAX_VANT;
    btnAddVant.disabled = cheio;
    btnAddVant.style.opacity = cheio ? '0.5' : '1';
    btnAddVant.textContent = cheio ? 'Limite de 5 vantagens atingido' : '+ Adicionar vantagem';
  }

  // cria um novo campo de vantagem (nome + valor), se não estourar o limite
  function criarCampoVant() {
    if (!listaVant || listaVant.children.length >= MAX_VANT) return;
    const item = document.createElement('div');
    item.className = 'field vant-item';
    item.style.cssText = 'display:flex; gap:8px; align-items:center;';
    item.innerHTML =
      '<input type="text" class="vant-nome" placeholder="Nome do vencimento" ' +
        'style="flex:1; padding:10px 12px; border:1.5px solid var(--borda); border-radius:10px; ' +
        'font-size:14px; font-family:inherit; color:var(--texto); background:#fff;">' +
      '<div class="money-row" style="flex:0 0 160px;">' +
        '<span class="money-prefix">R$</span>' +
        '<input type="number" class="vant-valor" data-commit="0" value="0" min="0" step="0.01" inputmode="decimal">' +
      '</div>' +
      '<button type="button" class="cen-btn campo-ok" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Confirmar (efetivar valor)">✓</button>' +
      '<button type="button" class="cen-btn vant-rem" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Remover">×</button>';
    listaVant.appendChild(item);
    atualizarBtnAddVant();
  }

  // habilita/desabilita o botão de adicionar verba indenizatória conforme o limite
  function atualizarBtnAddVind() {
    if (!listaVind || !btnAddVind) return;
    const cheio = listaVind.children.length >= MAX_VIND;
    btnAddVind.disabled = cheio;
    btnAddVind.style.opacity = cheio ? '0.5' : '1';
    btnAddVind.textContent = cheio ? 'Limite de 5 verbas atingido' : '+ Adicionar verba';
  }

  // cria um novo campo de verba indenizatória (nome + valor), se não estourar o limite
  function criarCampoVind() {
    if (!listaVind || listaVind.children.length >= MAX_VIND) return;
    const item = document.createElement('div');
    item.className = 'field vind-item';
    item.style.cssText = 'display:flex; gap:8px; align-items:center;';
    item.innerHTML =
      '<input type="text" class="vind-nome" placeholder="Ex.: Aux. Transporte" ' +
        'style="flex:1; padding:10px 12px; border:1.5px solid var(--borda); border-radius:10px; ' +
        'font-size:14px; font-family:inherit; color:var(--texto); background:#fff;">' +
      '<div class="money-row" style="flex:0 0 160px;">' +
        '<span class="money-prefix">R$</span>' +
        '<input type="number" class="vind-valor" data-commit="0" value="0" min="0" step="0.01" inputmode="decimal">' +
      '</div>' +
      '<button type="button" class="cen-btn campo-ok" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Confirmar (efetivar valor)">✓</button>' +
      '<button type="button" class="cen-btn vind-rem" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Remover">×</button>';
    listaVind.appendChild(item);
    atualizarBtnAddVind();
  }

  function calcular() {
    const opt = selPosto.options[selPosto.selectedIndex];
    let fator = 1;                                          // reajustes compostos
    if (chkReaj  && chkReaj.checked)  fator *= 1 + REAJUSTE1_PCT / 100;
    if (chkReaj2 && chkReaj2.checked) fator *= 1 + REAJUSTE2_PCT / 100;
    const soldo   = (parseFloat(opt.value) || 0) * fator;  // value do #posto (× reajustes)
    const gretPct = parseFloat(opt.dataset.gret) || 0;     // data-gret do #posto
    const ghpPct  = parseFloat(selHab.value) || 0;         // value do #habilitacao
    const triPct  = parseFloat(selTri.value) || 0;         // value do #trienio
    const fusPct  = selFus ? (parseFloat(selFus.value) || 0) : 0; // value do #fuspom

    // Posto atual é Coronel? (topo da hierarquia)
    const ehCel = opt.textContent.trim() === 'Cel PM';

    // Dif-Posto/Grad: diferença para o soldo de um posto ACIMA (escolhido pelo usuário).
    // Quando ativa, entra na base de TODAS as gratificações que incidem sobre o soldo.
    // Caso especial — Coronel: não há posto acima, então a Dif equivale a 20% do soldo.
    const difChk = document.getElementById('dif-chk');
    const selDif = document.getElementById('dif-posto');
    let dif = 0;
    if (difChk && difChk.checked) {
      if (ehCel) {
        dif = 0.20 * soldo; // Coronel: 20% do próprio soldo
      } else if (selDif && selDif.value) {
        dif = ((parseFloat(selDif.value) || 0) - (parseFloat(opt.value) || 0)) * fator;
        if (dif < 0) dif = 0; // proteção: substituto nunca abaixo do posto atual
      }
    }
    const base = soldo + dif; // base das gratificações = soldo + Dif-Posto/Grad

    const gret    = base * gretPct / 100;
    const ghp     = base * ghpPct / 100;
    const gram    = 0.625 * (base + gret + ghp);
    const trienio = (triPct / 100) * (base + gret + ghp + gram);

    // GEE — Gratificação de Encargos Especiais (exclusiva de Coronel): 60% de
    // (Soldo + Dif + GRET + GHP + GRAM). Integra a Remuneração Básica.
    const geeChk = document.getElementById('gee-chk');
    const gee    = (ehCel && geeChk && geeChk.checked) ? 0.60 * (base + gret + ghp + gram) : 0;

    const remBasica = base + gret + ghp + gram + trienio + gee;

    // outras vantagens remuneratórias (TRIBUTÁVEIS, somadas -> Rem. Bruta); agrupadas
    let totalVant = 0;
    if (listaVant) {
      listaVant.querySelectorAll('.vant-valor').forEach(function (inp) {
        totalVant += parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
      });
    }

    // verbas indenizatórias (NÃO tributáveis): entram na Rem. Bruta, saem do Rend. Tributável
    let totalVind = 0;
    if (listaVind) {
      listaVind.querySelectorAll('.vind-valor').forEach(function (inp) {
        totalVind += parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
      });
    }

    // Gratificações de Comando PMERJ (fora da Rem. Básica, da Contribuição e do teto)
    let totalGratCmd = 0;
    document.querySelectorAll('.gratcmd-valor').forEach(function (inp) {
      totalGratCmd += parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
    });

    // Teto Constitucional (limite remuneratório)
    const TETO_CONST = 41845.48;
    // Contribuição Militar (base limitada ao teto) — calculada aqui pois o Abono depende dela
    const contribMil = Math.min(remBasica, TETO_CONST) * CONTRIB_MIL_PCT / 100;
    // Abono de Permanência: devolve o valor da contribuição; tributável; entra na Bruta
    const chkAbono = document.getElementById('abono-chk');
    const abono = (chkAbono && chkAbono.checked) ? contribMil : 0;

    const remBruta = remBasica + totalVant + totalVind + totalGratCmd + abono;

    const baseTeto = remBasica + totalVant;   // sujeito ao teto (fora: indenizatórias, Grat Comando, Abono)
    const abateTeto = Math.max(0, baseTeto - TETO_CONST);

    // dependentes (IR)
    const dep = selDep ? (parseInt(selDep.value, 10) || 0) : 0;

    // descontos
    const fuspom     = soldo * fusPct / 100;               // FUSPOM (somente sobre o soldo)

    // descontos discricionários: soma dos campos, limitada a 40% da Rem. Básica
    const capDisc = 0.40 * remBasica;
    let somaDisc = 0;
    if (listaDesc) {
      listaDesc.querySelectorAll('.desc-disc-input').forEach(function (inp) {
        somaDisc += parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
      });
    }
    const descDisc = Math.min(Math.max(somaDisc, 0), capDisc);
    if (elDescDiscMax)   elDescDiscMax.textContent = fmt.format(capDisc);
    if (elDescDiscAviso) elDescDiscAviso.style.display = (somaDisc > capDisc) ? 'block' : 'none';

    // pensões (desconto): soma dos campos. Reduz o líquido E abate da base do IR.
    let pensao = 0;
    if (listaPensao) {
      listaPensao.querySelectorAll('.pensao-input').forEach(function (inp) {
        pensao += parseFloat(String(inp.dataset.commit).replace(',', '.')) || 0;
      });
    }

    // Rendimento Tributável (só para o redutor) = Rem. Bruta − Verbas Indenizatórias − (189,59 × dep) − FUSPOM
    const rendTrib = Math.max(0, remBruta - totalVind - dep * DED_DEP - fuspom);

    // IRPF (simulação)
    // Base de Cálculo = Rem. Bruta − Verbas Indenizatórias − [Contrib. Militar + dependentes OU 607,20 (o maior)] − FUSPOM − Pensão(0)
    const dedDep   = dep * DED_DEP;
    const parLegal = contribMil + dedDep;                       // Contrib. Militar + dependentes
    const parUsado = (parLegal < DESC_SIMPL) ? DESC_SIMPL : parLegal; // desconto simplificado se for maior
    // isenção da GRAM no IR: se marcada, abate a GRAM da base de cálculo (não mexe no Rend. Tributável)
    const abateGram = (chkIsencaoGram && chkIsencaoGram.checked) ? gram : 0;
    const baseIR   = Math.max(0, remBruta - totalVind - parUsado - fuspom - pensao - abateGram - abateTeto);
    const irBruto  = irTabela(baseIR);
    const reducao  = redutorIR(rendTrib, irBruto);
    const irrf     = Math.max(0, irBruto - reducao);

    // Remuneração Líquida = Rem. Bruta − todos os descontos
    const totalDescontos = contribMil + fuspom + descDisc + irrf + pensao + abateTeto;
    const liquido = remBruta - totalDescontos;

    // marcadores (.big-num)
    set('r-rem-bruta', fmt.format(remBruta));
    set('r-desc', fmt.format(totalDescontos));
    set('r-liquido', fmt.format(liquido));
    document.body.dataset.rendtrib = rendTrib.toFixed(2);
    document.body.dataset.baseir = baseIR.toFixed(2);
    aplicarVisibilidadeZeros({
      't-soldo': soldo, 't-dif': dif, 't-gret': gret, 't-ghp': ghp,
      't-gram': gram, 't-trienio': trienio, 't-gee': gee,
      't-vant': totalVant, 't-vind': totalVind, 't-gratcmd': totalGratCmd,
      't-abono': abono, 't-fuspom': fuspom, 't-desc-disc': descDisc,
      't-irrf': irrf, 't-pensao': pensao, 't-abate': abateTeto
    });

    // detalhamento (table.breakdown)
    set('t-soldo', fmt.format(soldo));
    set('t-dif', '+ ' + fmt.format(dif));
    set('t-gret-p', pct(gretPct));
    set('t-gret', '+ ' + fmt.format(gret));
    set('t-ghp-p', pct(ghpPct));
    set('t-ghp', '+ ' + fmt.format(ghp));
    set('t-gram', '+ ' + fmt.format(gram));
    set('t-tri-p', pct(triPct));
    set('t-trienio', '+ ' + fmt.format(trienio));
    set('t-gee', '+ ' + fmt.format(gee));
    set('t-rem-basica', fmt.format(remBasica));
    set('t-vant', '+ ' + fmt.format(totalVant));
    set('t-vind', '+ ' + fmt.format(totalVind));
    set('t-gratcmd', '+ ' + fmt.format(totalGratCmd));
    set('t-abono', '+ ' + fmt.format(abono));
    set('t-rem-bruta', fmt.format(remBruta));
    set('t-contrib', '− ' + fmt.format(contribMil));
    set('t-fuspom-p', pct(fusPct));
    set('t-fuspom', '− ' + fmt.format(fuspom));
    set('t-desc-disc', '− ' + fmt.format(descDisc));
    set('t-irrf', '− ' + fmt.format(irrf));
    set('t-pensao', '− ' + fmt.format(pensao));
    set('t-abate', '− ' + fmt.format(abateTeto));
    set('t-liquido', fmt.format(liquido));
  }

  selPosto.addEventListener('change', calcular);
  selHab.addEventListener('change', calcular);
  selTri.addEventListener('change', calcular);
  if (selFus) selFus.addEventListener('change', calcular);
  if (selDep) selDep.addEventListener('input', calcular);

  // verbas indenizatórias: adicionar / digitar valor / remover
  if (btnAddVind) btnAddVind.addEventListener('click', function () { criarCampoVind(); calcular(); });
  if (listaVind) {
    listaVind.addEventListener('input', function (e) {
      if (e.target && e.target.classList.contains('vind-valor')) marcarPendente(e.target);
    });
    listaVind.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('campo-ok')) { confirmarCampo(e.target); return; }
      if (e.target && e.target.classList.contains('vind-rem')) {
        const item = e.target.closest('.vind-item');
        if (item) item.remove();
        atualizarBtnAddVind();
        calcular();
      }
    });
  }
  atualizarBtnAddVind();

  // outras vantagens: adicionar / digitar valor / remover
  if (btnAddVant) btnAddVant.addEventListener('click', function () { criarCampoVant(); calcular(); });
  if (listaVant) {
    listaVant.addEventListener('input', function (e) {
      if (e.target && e.target.classList.contains('vant-valor')) marcarPendente(e.target);
    });
    listaVant.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('campo-ok')) { confirmarCampo(e.target); return; }
      if (e.target && e.target.classList.contains('vant-rem')) {
        const item = e.target.closest('.vant-item');
        if (item) item.remove();
        atualizarBtnAddVant();
        calcular();
      }
    });
  }
  atualizarBtnAddVant();

  // descontos discricionários: adicionar / digitar / remover
  if (btnAddDesc) btnAddDesc.addEventListener('click', function () { criarCampoDesc(); calcular(); });
  if (listaDesc) {
    listaDesc.addEventListener('input', function (e) {
      if (e.target && e.target.classList.contains('desc-disc-input')) marcarPendente(e.target);
    });
    listaDesc.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('campo-ok')) { confirmarCampo(e.target); return; }
      if (e.target && e.target.classList.contains('desc-disc-rem')) {
        const item = e.target.closest('.desc-disc-item');
        if (item) item.remove();
        atualizarBtnAdd();
        calcular();
      }
    });
  }
  atualizarBtnAdd();

  // pensões: adicionar / digitar / remover
  if (btnAddPensao) btnAddPensao.addEventListener('click', function () { criarCampoPensao(); calcular(); });
  if (listaPensao) {
    listaPensao.addEventListener('input', function (e) {
      if (e.target && e.target.classList.contains('pensao-input')) marcarPendente(e.target);
    });
    listaPensao.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('campo-ok')) { confirmarCampo(e.target); return; }
      if (e.target && e.target.classList.contains('pensao-rem')) {
        const item = e.target.closest('.pensao-item');
        if (item) item.remove();
        atualizarBtnAddPensao();
        calcular();
      }
    });
  }
  atualizarBtnAddPensao();

  if (chkReaj) chkReaj.addEventListener('change', function () {
    // 2º reajuste só fica disponível com o 1º ligado
    if (chkReaj2) {
      chkReaj2.disabled = !chkReaj.checked;
      if (!chkReaj.checked) chkReaj2.checked = false;
    }
    calcular();
  });
  if (chkReaj2) chkReaj2.addEventListener('change', calcular);
  if (chkIsencaoGram) chkIsencaoGram.addEventListener('change', calcular);

  // esconde rubricas zeradas; comp-rows respeitam também o estado do "Ver detalhamento"
  let compAberta = false;
  function aplicarVisibilidadeZeros(valores) {
    Object.keys(valores).forEach(function (id) {
      const el = document.getElementById(id);
      const tr = el ? el.closest('tr') : null;
      if (!tr) return;
      const zero = Math.abs(valores[id]) < 0.005;
      if (tr.classList.contains('comp-row')) tr.style.display = (compAberta && !zero) ? '' : 'none';
      else tr.style.display = zero ? 'none' : '';
    });
  }

  // toggle: mostrar/esconder a composição da Remuneração Básica
  const compToggle = document.getElementById('comp-toggle');
  const compArrow = document.getElementById('comp-arrow');
  if (compToggle) {
    compToggle.addEventListener('click', function () {
      compAberta = !compAberta;
      if (compArrow) compArrow.textContent = compAberta ? '▾' : '▸';
      calcular();
    });
  }

  // rótulo do GHP no breakdown: "GHP (x%)" sem "Habilitação"
  (function () {
    const g = document.getElementById('t-ghp');
    const lbl = g ? g.closest('tr').querySelector('.lbl-cell') : null;
    if (lbl) lbl.innerHTML = lbl.innerHTML.replace('GHP \u2014 Habilitação (', 'GHP (').replace('GHP \u2013 Habilitação (', 'GHP (').replace('GHP - Habilitação (', 'GHP (');
  })();
  calcular(); // cálculo inicial com os valores padrão
});


// ===== Card "Gratificações de Comando PMERJ" (só ativos), abaixo de Outras Vantagens =====
document.addEventListener('DOMContentLoaded', function () {
  const vantLista = document.getElementById('vant-lista');
  const cardVant = vantLista ? vantLista.closest('.card') : null;
  if (!cardVant) return;
  const posto = document.getElementById('posto');
  function campo(rotulo, id) {
    return '<div class="field" style="display:flex; gap:8px; align-items:center;">' +
      '<label style="flex:1; margin:0;">' + rotulo + '</label>' +
      '<div class="money-row" style="flex:0 0 160px;">' +
        '<span class="money-prefix">R$</span>' +
        '<input type="number" class="gratcmd-valor" id="' + id + '" data-commit="0" value="0" min="0" step="0.01" inputmode="decimal">' +
      '</div>' +
      '<button type="button" class="cen-btn campo-ok" style="flex:0 0 auto; width:auto; padding:5px 8px; font-size:13px; line-height:1;" title="Confirmar (efetivar valor)">✓</button>' +
    '</div>';
  }
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginTop = '16px';
  card.innerHTML =
    '<h2>Gratificações de Comando PMERJ</h2>' +
    campo('Subsídio / GEE Comando PMERJ', 'gc-subsidio') +
    campo('Verba de Representação de Cargo', 'gc-representacao') +
    campo('Cargo em Comissão', 'gc-comissao') +
    '<div class="hint-exp">Entram na Remuneração Bruta e na base do IRPF; ficam fora da Remuneração Básica, da Contribuição e do abate-teto.</div>';
  cardVant.parentNode.insertBefore(card, cardVant.nextSibling);

  // Grat de Comando: exclusiva de Ten Cel PM e Cel PM. Esconde (e zera) nos demais.
  function atualizarVisibilidade() {
    const p = posto ? posto.options[posto.selectedIndex].textContent.trim() : '';
    const podeTer = (p === 'Cel PM' || p === 'Ten Cel PM');
    card.style.display = podeTer ? '' : 'none';
    if (!podeTer) {
      card.querySelectorAll('.gratcmd-valor').forEach(function (inp) {
        inp.value = '0'; inp.dataset.commit = '0';
      });
    }
  }
  if (posto) posto.addEventListener('change', atualizarVisibilidade);
  atualizarVisibilidade();

  card.addEventListener('input', function (e) {
    if (e.target && e.target.classList.contains('gratcmd-valor')) {
      const item = e.target.closest('.field');
      const btn = item ? item.querySelector('.campo-ok') : null;
      if (btn) { btn.style.background = 'var(--acento)'; btn.style.color = '#fff'; }
    }
  });
  card.addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('campo-ok')) {
      const item = e.target.closest('.field');
      const inp = item ? item.querySelector('input[type=number]') : null;
      if (inp) inp.dataset.commit = inp.value || '0';
      e.target.style.background = ''; e.target.style.color = ''; e.target.textContent = '\u2713';
      if (posto) posto.dispatchEvent(new Event('change'));
    }
  });
});

// ===== Checkbox "Possui Abono de Permanência" (só ativos), abaixo do breakdown =====
document.addEventListener('DOMContentLoaded', function () {
  const table = document.querySelector('table.breakdown');
  if (!table) return;
  const posto = document.getElementById('posto');
  const box = document.createElement('div');
  box.style.cssText = 'margin-top:16px; padding-top:14px; border-top:1px solid #e7eef6;';
  box.innerHTML =
    '<label for="abono-chk" style="display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer;font-size:13px;">' +
      '<input type="checkbox" id="abono-chk"> Possui Abono de Permanência' +
    '</label>' +
    '<div class="hint" style="margin-top:6px;">Indenização igual à Contribuição Militar: devolve esse valor ao líquido e é tributável (entra na base do IRPF). Fica fora do abate-teto.</div>';
  table.parentNode.insertBefore(box, table.nextSibling);
  const chk = document.getElementById('abono-chk');
  if (chk && posto) chk.addEventListener('change', function () { posto.dispatchEvent(new Event('change')); });
});
