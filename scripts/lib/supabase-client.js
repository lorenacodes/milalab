// Cliente Supabase e helper de tradução de erros — usado por todo o sistema
var _SUPA_URL = 'https://pnecdbobhywfjdadylwt.supabase.co';
var _SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZWNkYm9iaHl3ZmpkYWR5bHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTA4MjcsImV4cCI6MjA5NTAyNjgyN30.LIp_DxziZqHNyxR3EFsb04m7LEbkOATkqjgrBZUiLZA';
var _sb = supabase.createClient(_SUPA_URL, _SUPA_KEY);

function _supaErrPt(msg) {
 if (!msg) return 'Erro desconhecido.';
 var m = msg.toLowerCase();
 if (m.includes('same password') || m.includes('different from the old'))
  return 'A nova senha não pode ser igual à senha atual. Escolha uma senha diferente.';
 if (m.includes('invalid login') || m.includes('invalid credentials'))
  return 'E-mail ou senha incorretos.';
 if (m.includes('email not confirmed'))
  return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
 if (m.includes('token') && m.includes('expired'))
  return 'Link expirado. Solicite um novo link de redefinição.';
 if (m.includes('token') && (m.includes('invalid') || m.includes('not found')))
  return 'Link inválido ou já utilizado. Solicite um novo link de redefinição.';
 if (m.includes('rate limit') || m.includes('over_email_send') || m.includes('429'))
  return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.';
 if (m.includes('user already registered') || m.includes('already been registered'))
  return 'Este e-mail já está cadastrado no sistema.';
 if (m.includes('password') && m.includes('weak'))
  return 'Senha muito fraca. Use ao menos 8 caracteres com letras e números.';
 if (m.includes('network') || m.includes('fetch'))
  return 'Erro de conexão. Verifique sua internet e tente novamente.';
 if (m.includes('email link is invalid') || m.includes('otp'))
  return 'Link inválido ou expirado. Solicite um novo link.';
 // Retorna original como fallback, mas com prefixo em PT
 return 'Erro: ' + msg;
}
