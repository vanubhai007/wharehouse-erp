import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import { ProtectedRoute, RoleRoute } from './components/common/ProtectedRoute';

import Login from './pages/auth/Login';
import Setup from './pages/auth/Setup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import Dashboard from './pages/Dashboard';

import CustomerList from './pages/customers/CustomerList';
import CustomerProfile from './pages/customers/CustomerProfile';

import BuyerList from './pages/buyers/BuyerList';
import BuyerProfile from './pages/buyers/BuyerProfile';

import ItemList from './pages/inventory/ItemList';
import ItemDetail from './pages/inventory/ItemDetail';

import WarehouseMap from './pages/warehouse/WarehouseMap';
import RentalReport from './pages/warehouse/RentalReport';

import RefurbishmentList from './pages/refurbishment/RefurbishmentList';

import SaleProposalList from './pages/sales/SaleProposalList';
import SaleProposalDetail from './pages/sales/SaleProposalDetail';

import SalesInquiryList from './pages/sales-inquiries/SalesInquiryList';

import BuyerInquiryList from './pages/buyers/BuyerInquiryList';

import StickerGenerator from './pages/stickers/StickerGenerator';

import ApprovalList from './pages/approvals/ApprovalList';

import InvoiceList from './pages/invoices/InvoiceList';
import InvoiceView from './pages/invoices/InvoiceView';

import DispatchList from './pages/dispatch/DispatchList';
import DispatchDetail from './pages/dispatch/DispatchDetail';

import SettlementList from './pages/settlements/SettlementList';

import ReportsHub from './pages/reports/ReportsHub';

import UserManagement from './pages/users/UserManagement';
import SettingsPage from './pages/settings/SettingsPage';

import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />

          <Route path="/buyers" element={<BuyerList />} />
          <Route path="/buyers/:id" element={<BuyerProfile />} />
          <Route path="/buyer-inquiries" element={<BuyerInquiryList />} />

          <Route path="/inventory" element={<ItemList />} />
          <Route path="/inventory/:id" element={<ItemDetail />} />

          <Route path="/warehouse" element={<WarehouseMap />} />
          <Route path="/warehouse/rental-report" element={<RentalReport />} />

          <Route path="/refurbishment" element={<RefurbishmentList />} />

          <Route path="/sales" element={<SaleProposalList />} />
          <Route path="/sales/:id" element={<SaleProposalDetail />} />

          <Route path="/sales-inquiries" element={<SalesInquiryList />} />

          <Route path="/stickers" element={<StickerGenerator />} />

          <Route path="/approvals" element={<ApprovalList />} />

          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />

          <Route path="/dispatch" element={<DispatchList />} />
          <Route path="/dispatch/:id" element={<DispatchDetail />} />

          <Route path="/settlements" element={<SettlementList />} />

          <Route path="/reports" element={<ReportsHub />} />

          <Route element={<RoleRoute roles={['Admin']} />}>
            <Route path="/users" element={<UserManagement />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
