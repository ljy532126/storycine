import { io } from 'socket.io-client';
import { ref, onUnmounted } from 'vue';

const SOCKET_URL = '/';
const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

socket.on('connect', () => {});
socket.on('disconnect', () => {});
socket.on('connect_error', () => {});

export function useSocket() {
  const connected = ref(false);
  const _listeners = []; // 实例级追踪，卸载时只清理自己的

  function _on(event, callback) {
    _listeners.push({ event, callback });
    socket.on(event, callback);
  }

  function off(event, callback) {
    const idx = _listeners.findIndex(l => l.event === event && l.callback === callback);
    if (idx >= 0) _listeners.splice(idx, 1);
    socket.off(event, callback);
  }

  function connect() {
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
    socket.emit('join-project', projectId);
  }

  function leaveProject(projectId) {
    socket.emit('leave-project', projectId);
  }

  function onScriptGenerationProgress(callback) { _on('script-generation-progress', callback); }
  function onScriptGenerationComplete(callback) { _on('script-generation-complete', callback); }
  function onScriptGenerationError(callback) { _on('script-generation-error', callback); }
  function onScriptContinueComplete(callback) { _on('script-continue-complete', callback); }
  function onCompositionProgress(callback) { _on('composition-progress', callback); }
  function onCompositionComplete(callback) { _on('composition-complete', callback); }

  function offAll() {
    _listeners.forEach(l => socket.off(l.event, l.callback));
    _listeners.length = 0;
  }

  onUnmounted(() => { offAll(); });

  return {
    connected, connect, disconnect, joinProject, leaveProject,
    on: _on, off,
    onScriptGenerationProgress, onScriptGenerationComplete, onScriptGenerationError,
    onScriptContinueComplete, onCompositionProgress, onCompositionComplete,
    offAll,
  };
}
