import { connect, createOverlay } from './shared.js';
const overlay = createOverlay(document.querySelector('.pc-overlay'));
let revision = -1;
connect(state => { if (state.revision < revision) return; revision = state.revision; overlay.render(state.poll, state.serverNow); }, value => overlay.connection(value));
