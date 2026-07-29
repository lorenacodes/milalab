// Motivo: toast centraliza feedback visual de sucesso/erro sem depender de alert()
function _showToast(msg, tipo) {
 var t = document.createElement('div');
 var bg = tipo === 'erro' ? '#f38ba8' : '#1F8A4C';
 var fg = tipo === 'erro' ? '#1e1e2e' : '#fff';
 t.style = 'position:fixed;bottom:20px;right:20px;padding:10px 18px;border-radius:8px;'
  + 'font-size:13px;font-weight:600;z-index:9999;opacity:1;transition:opacity .35s;'
  + 'background:' + bg + ';color:' + fg + ';box-shadow:0 4px 16px rgba(0,0,0,.22)';
 t.textContent = msg;
 document.body.appendChild(t);
 setTimeout(function(){ t.style.opacity = '0'; setTimeout(function(){ t.remove(); }, 380); }, 2600);
}
