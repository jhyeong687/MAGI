import { useEffect, useState } from 'react';
import type { Environment, Locale, LoginState } from '../shared/domain.ts';
import { request } from './api.ts';

const text = {
  zh: {
    title: '连接你的 CHATGPT 账户',
    description: '每个人使用自己的账户登录。MAGI 使用此电脑上的 CODEX 认证，不收集密码或令牌。',
    action: '使用 CHATGPT 登录',
    pending: '请在浏览器中完成登录…',
    cancel: '取消登录',
    check: '重新检查连接',
    terminal: '如果浏览器未打开，请在项目文件夹的终端中运行。',
    limits: '需要具有 CODEX 使用权限的账户或工作区。使用量及限额计入登录的账户。',
    missing: '未找到 CODEX，请运行 npm ci 后重试。',
  },
  ko: {
    title: '사용자의 ChatGPT 계정을 연결하라',
    description:
      '각자 자신의 계정으로 로그인한다. MAGI는 이 컴퓨터에 저장된 Codex 인증을 사용하며, 로그인 비밀번호나 토큰을 수집하지 않는다.',
    action: 'ChatGPT로 로그인',
    pending: '브라우저에서 로그인을 완료하라…',
    cancel: '로그인 중지',
    check: '연결 다시 확인',
    terminal: '브라우저가 열리지 않으면 이 폴더의 터미널에서 실행하라.',
    limits:
      'Codex를 사용할 수 있는 계정·워크스페이스가 필요하다. 사용량과 한도는 로그인한 계정에 적용된다.',
    missing: 'Codex 실행 파일을 찾지 못했다. npm ci로 설치한 뒤 다시 확인하라.',
  },
  en: {
    title: 'CONNECT YOUR CHATGPT ACCOUNT',
    description:
      'Sign in with your own account. MAGI uses Codex credentials stored on this computer; it never collects your password or tokens.',
    action: 'Sign in with ChatGPT',
    pending: 'Complete sign-in in your browser…',
    cancel: 'Cancel sign-in',
    check: 'Check connection',
    terminal: 'If the browser does not open, run this in the project terminal.',
    limits: 'An account/workspace with Codex access is required. Your account usage limits apply.',
    missing: 'Codex was not found. Run npm ci, then check again.',
  },
  ja: {
    title: '自分のCHATGPTアカウントを接続せよ',
    description:
      '各自のアカウントでログインする。このPCに保存されたCodex認証を使い、パスワードやトークンを収集しない。',
    action: 'ChatGPTでログイン',
    pending: 'ブラウザでログインを完了せよ…',
    cancel: 'ログインを中止',
    check: '接続を再確認',
    terminal: 'ブラウザが開かない場合は、このフォルダのターミナルで実行せよ。',
    limits:
      'Codexを利用できるアカウント・ワークスペースが必要。利用量と上限は自分のアカウントに適用される。',
    missing: 'Codexが見つからない。npm ciを実行して再確認せよ。',
  },
};
export default function AuthPanel({
  environment,
  locale,
  onReady,
  busy,
}: {
  environment: Environment;
  locale: Locale;
  onReady: (env: Environment) => void;
  busy: boolean;
}) {
  const t = text[locale];
  const [login, setLogin] = useState<LoginState>({ status: 'idle' });
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const pending = login.status === 'pending';
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const state = await request<LoginState>('/api/auth');
        if (!alive) return;
        setLogin(state);
        if (state.status === 'completed') {
          const env = await request<Environment>('/api/environment?refresh=1');
          if (alive) onReady(env);
        }
      } catch (err) {
        if (alive) setError(String(err));
      }
    };
    void check();
    const timer = pending ? setInterval(() => void check(), 1000) : undefined;
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pending, onReady]);
  async function start() {
    setError('');
    setChecking(true);
    try {
      const state = await request<LoginState>('/api/auth/login', { method: 'POST', body: '{}' });
      setLogin(state);
      if (state.status === 'completed')
        onReady(await request<Environment>('/api/environment?refresh=1'));
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }
  async function recheck() {
    setChecking(true);
    setError('');
    try {
      onReady(await request<Environment>('/api/environment?refresh=1'));
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }
  return (
    <section className="auth-panel" aria-labelledby="auth-title" data-testid="auth-panel">
      <header>
        <small>PERSONAL ACCOUNT / INITIALIZATION</small>
        <h2 id="auth-title">{t.title}</h2>
      </header>
      <p>{t.description}</p>
      <p className="auth-limits">{t.limits}</p>
      {!environment.binary && <p role="status">{t.missing}</p>}
      <div className="auth-actions">
        <button
          className="primary"
          onClick={() => void start()}
          disabled={pending || checking || busy || !environment.binary}
        >
          {pending ? t.pending : t.action} ↗
        </button>
        <button onClick={() => void recheck()} disabled={checking}>
          {t.check}
        </button>
        {pending && (
          <button
            onClick={() =>
              void request<LoginState>('/api/auth/cancel', { method: 'POST', body: '{}' })
                .then(setLogin)
                .catch((err) => setError(String(err)))
            }
          >
            {t.cancel}
          </button>
        )}
      </div>
      <p className="auth-terminal">
        {t.terminal} <code>npm run login</code>
      </p>
      {(error || login.error) && (
        <p className="error-text" role="alert">
          {error || login.error}
        </p>
      )}
    </section>
  );
}
