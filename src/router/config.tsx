import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const HomePage = lazy(() => import('../pages/home/page'));
const ListingsPage = lazy(() => import('../pages/listings/page'));
const ListingDetailPage = lazy(() => import('../pages/listing-detail/page'));
const CreateListingPage = lazy(() => import('../pages/create-listing/page'));
const AboutPage = lazy(() => import('../pages/about/page'));
const ReviewsPage = lazy(() => import('../pages/reviews/page'));
const LoginPage = lazy(() => import('../pages/auth/login/page'));
const RegisterPage = lazy(() => import('../pages/auth/register/page'));
const WhatsAppResetPinPage = lazy(() => import('../pages/auth/whatsapp-reset-pin/page'));
const ProfilePage = lazy(() => import('../pages/profile/page'));
const ManageListingsPage = lazy(() => import('../pages/profile/listings/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/listings',
    element: <ListingsPage />,
  },
  {
    path: '/listing/:id',
    element: <ListingDetailPage />,
  },
  {
    path: '/create-listing',
    element: <CreateListingPage />,
  },
  {
    path: '/about',
    element: <AboutPage />,
  },
  {
    path: '/reviews',
    element: <ReviewsPage />,
  },
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/register',
    element: <RegisterPage />,
  },
  {
    path: '/auth/whatsapp-reset-pin',
    element: <WhatsAppResetPinPage />,
  },
  {
    path: '/profile',
    element: <ProfilePage />,
  },
  {
    path: '/profile/listings',
    element: <ManageListingsPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
