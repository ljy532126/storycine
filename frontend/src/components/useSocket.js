import { io } from 'socket.io-client';
import { ref, onUnmounted } from 'vue';

const SOCKET_URL = import.meta.env.DEV ? '/' : '/';
const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

// 全局调试
socket.on('connect', () => {
  console.log('[socket] 已连接 id=' + socket.id);
});
socket.on('disconnect', (reason) => {
  console.log('[socket] 断开连接 reason=' + reason);
});
socket.on('connect_error', (err) => {
  console.error('[socket] 连接错误', err.message);
});

export function useSocket() {
  const connected = ref(false);

  function connect() {
    console.log('[socket] connect() 调用, 当前状态 connected=' + socket.connected);
    if (!socket.connected) {
      socket.connect();
    }
  }

  function disconnect() {
    if (socket.connected) {
      socket.disconnect();
      connected.value = false;
    }
  }

  function joinProject(projectId) {
    console.log('[socket] joinProject ' + projectId);
    socket.emit('join-project', projectId);
  }

  function leaveProject(projectId) {
    socket.emit('leave-project', projectId);
  }

  // 包装所有监听器加日志
  function _on(event, callback) {
    console.log('[socket] 注册监听: ' + event);
    socket.on(event, (...args) => {
      console.log('[socket] 收到事件: ' + event, args[0]);
      callback(...args);
    });
  }

  function onScriptGenerationProgress(callback) { _on('script-generation-progress', callback); }
  function onScriptGenerationComplete(callback) { _on('script-generation-complete', callback); }
  function onScriptGenerationError(callback) { _on('script-generation-error', callback); }
  function onScriptContinueComplete(callback) { _on('script-continue-complete', callback); }
  function onCompositionProgress(callback) { _on('composition-progress', callback); }
  function onCompositionComplete(callback) { _on('composition-complete', callback); }

  function offAll() {
    console.log('[socket] 清除所有监听');
    socket.off('script-generation-progress');
    socket.off('script-generation-complete');
    socket.off('script-generation-error');
    socket.off('script-continue-complete');
    socket.off('composition-progress');
    socket.off('composition-complete');
    socket.off('composition-error');
  }

  onUnmounted(() => { offAll(); });

  return {
    connected, connect, disconnect, joinProject, leaveProject,
    onScriptGenerationProgress, onScriptGenerationComplete, onScriptGenerationError,
    onScriptContinueComplete, onCompositionProgress, onCompositionComplete,
    offAll,
  };
}
