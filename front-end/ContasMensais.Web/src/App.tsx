import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import './App.css';
import ListaContas from './components/ListaContas';

function App() {
  return (
    <main>
      <h1>Controle de Contas Mensais</h1>
      <ListaContas />
      <button className="btn-flutuante" onClick={() => window.scrollTo(0, 0)}>
        +
      </button>
      <ToastContainer position="top-right" autoClose={3000} />
    </main>
  );
}

export default App;
