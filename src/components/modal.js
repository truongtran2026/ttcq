export function openOverlay(id) {
  document.getElementById(id).classList.add('open');
}

export function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
}

// Đóng modal khi click ra ngoài (click đúng vào overlay, không phải nội dung modal bên trong).
export function wireOverlayBackdropClose(id) {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) closeOverlay(id);
  });
}
