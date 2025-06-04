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
    </main>
  );
}

export default App;
