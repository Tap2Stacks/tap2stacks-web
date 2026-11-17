import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { TradingView } from "./TradingView";
import { HistoryView } from "./HistoryView";
import { WalletView } from "./WalletView";
import { ProofsView } from "./ProofsView";
import { Toaster } from "react-hot-toast";

import { Layout } from "./shell/Layout";

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/trade" replace />} />
          <Route path="/trade" element={<TradingView />} />
          <Route path="/history" element={<HistoryView />} />
          <Route path="/wallet" element={<WalletView />} />
          <Route path="/proofs" element={<ProofsView />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
