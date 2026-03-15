import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/jobs',
  },
  {
    path: '/jobs',
    name: 'jobs',
    component: () => import('@/views/JobsView.vue'),
  },
  {
    path: '/jobs/:jobId',
    name: 'job-detail',
    component: () => import('@/views/JobDetailView.vue'),
    props: true,
  },
  {
    path: '/create',
    name: 'create-job',
    component: () => import('@/views/CreateJobView.vue'),
  },
  {
    path: '/cache',
    name: 'cache',
    component: () => import('@/views/CacheView.vue'),
  },
  {
    path: '/docs',
    name: 'docs',
    component: () => import('@/views/ApiDocsView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
