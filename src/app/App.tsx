import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireOwner } from './guards';
import { ShopDataProvider } from './data';
import { Layout } from './Layout';
import { Login } from '../screens/Login';
import { Billing } from '../screens/Billing';
import { Payment } from '../screens/Payment';
import { Orders } from '../screens/Orders';
import { OrderDetail } from '../screens/OrderDetail';
import { Settings } from '../screens/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <ShopDataProvider>
              <Layout />
            </ShopDataProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Billing />} />
        <Route path="payment" element={<Payment />} />
        <Route
          path="orders"
          element={
            <RequireOwner>
              <Orders />
            </RequireOwner>
          }
        />
        <Route
          path="orders/:id"
          element={
            <RequireOwner>
              <OrderDetail />
            </RequireOwner>
          }
        />
        <Route
          path="settings/*"
          element={
            <RequireOwner>
              <Settings />
            </RequireOwner>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
