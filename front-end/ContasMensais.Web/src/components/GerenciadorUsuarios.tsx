import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import type { Usuario } from '../types/Usuario';

type GerenciadorUsuariosProps = {
  aberto: boolean;
  fechando: boolean;
  onFechar: () => void;
};

function GerenciadorUsuarios({ aberto, fechando, onFechar }: GerenciadorUsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    setCarregando(true);

    api.get<Usuario[]>('/usuarios')
      .then((response) => {
        setUsuarios(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        toast.error('Erro ao carregar usuários.');
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [aberto]);

  function limparFormulario() {
    setNome('');
    setEmail('');
    setPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.warning('Informe e-mail e senha.');
      return;
    }

    if (password.length < 8) {
      toast.warning('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setSalvando(true);

    try {
      const { data } = await api.post<Usuario>('/usuarios', {
        nome: nome.trim(),
        email: email.trim(),
        password,
      });

      setUsuarios((usuariosAtuais) => [...usuariosAtuais, data]
        .sort((usuarioA, usuarioB) => usuarioA.nome.localeCompare(usuarioB.nome)));
      limparFormulario();
      toast.success('Usuário cadastrado com sucesso.');
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;

      if (status === 409) {
        toast.error('Já existe um usuário com este e-mail.');
        return;
      }

      toast.error('Erro ao cadastrar usuário.');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return null;
  }

  return (
    <div
      className={`modal-overlay ${fechando ? 'closing' : ''}`}
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div className={`modal usuarios-modal ${fechando ? 'closing' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Usuários</h3>
          <button type="button" className="modal-close" onClick={onFechar}>
            x
          </button>
        </div>

        <div className="modal-body">
          <form className="usuarios-form" onSubmit={handleSubmit}>
            <label>
              Nome
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Nome do usuário"
                autoComplete="name"
              />
            </label>

            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@email.com"
                autoComplete="email"
              />
            </label>

            <label>
              Senha temporária
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
              />
            </label>

            <button type="submit" disabled={salvando}>
              {salvando ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </form>

          <div className="usuarios-lista">
            <h4>Usuários cadastrados</h4>

            {carregando && <p className="usuarios-status">Carregando...</p>}

            {!carregando && usuarios.length === 0 && (
              <p className="usuarios-status">Nenhum usuário cadastrado.</p>
            )}

            {!carregando && usuarios.map((usuario) => (
              <div className="usuario-item" key={usuario.id}>
                <strong>{usuario.nome || usuario.email}</strong>
                <span>{usuario.email}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GerenciadorUsuarios;
