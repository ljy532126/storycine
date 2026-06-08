import { io } from 'socket.io-client';
import { ref, onUnmounted } from 'vue';

const SOCKET_URL = '/';
const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

socket.on('connect', () => {});
socket.on('disconnect', () => {});
socket.on('connect_error', () => {});

export function useSocket() {
  const connected = ref(false);

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

  function _on(event, callback) {
    socket.on(event, (...args) => { callback(...args); });
  }

  function onScriptGenerationProgress(callback) { _on('script-generation-progress', callback); }
  function onScriptGenerationComplete(callback) { _on('script-generation-complete', callback); }
  function onScriptGenerationError(callback) { _on('script-generation-error', callback); }
  function onScriptContinueComplete(callback) { _on('script-continue-complete', callback); }
  function onCompositionProgress(callback) { _on('composition-progress', callback); }
  function onCompositionComplete(callback) { _on('composition-complete', callback); }

  function offAll() {
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
    on: _on,
    onScriptGenerationProgress, onScriptGenerationComplete, onScriptGenerationError,
    onScriptContinueComplete, onCompositionProgress, onCompositionComplete,
    offAll,
  };
}
