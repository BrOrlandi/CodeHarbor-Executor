<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-brand">
        <img src="/logo-notext.svg" alt="CodeHarbor" class="login-logo" />
        <h1 class="login-title">CodeHarbor</h1>
        <p class="login-subtitle">Executor Dashboard</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="field">
          <label for="secretKey">Secret Key</label>
          <input
            id="secretKey"
            type="password"
            v-model="secretKey"
            placeholder="Enter your secret key"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <p v-if="error" class="field-error">{{ error }}</p>

        <button type="submit" class="login-btn" :disabled="loading || !secretKey">
          <span v-if="loading" class="btn-spinner"></span>
          {{ loading ? 'Authenticating...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client.js';

const router = useRouter();
const secretKey = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await api.post('/login', { secretKey: secretKey.value });
    router.push({ name: 'jobs' });
  } catch (err) {
    error.value = err.message || 'Authentication failed';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-base);
  padding: 24px;
}

.login-container {
  width: 100%;
  max-width: 360px;
}

.login-brand {
  text-align: center;
  margin-bottom: 40px;
}

.login-logo {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 20px rgba(28, 140, 246, 0.3));
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 500;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.field input {
  padding: 10px 14px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--duration);
}

.field input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-wash);
}

.field input::placeholder {
  color: var(--text-muted);
}

.field-error {
  color: var(--error);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255, 69, 58, 0.08);
  border-radius: var(--radius);
  border-left: 2px solid var(--error);
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  background: var(--brand);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  transition: background var(--duration);
  margin-top: 4px;
}

.login-btn:hover:not(:disabled) {
  background: var(--brand-light);
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
