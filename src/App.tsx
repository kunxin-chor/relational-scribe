import { Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { SchemaFlow } from './components/SchemaFlow';
import { Toolbar } from './components/Toolbar';

import { RelationshipMappingModal } from './components/RelationshipMappingModal';
import { SavesBrowser } from './components/SavesBrowser';
import './App.css';

function Editor() {
  return (
    <div className="app">
      <Toolbar />
      <div className="flow-wrapper">
        <SchemaFlow />
      </div>
      <RelationshipMappingModal />
    </div>
  );
}

function App() {
  return (
    <Router hook={useHashLocation}>
      <Route path="/" component={Editor} />
      <Route path="/saves" component={SavesBrowser} />
    </Router>
  );
}

export default App;
