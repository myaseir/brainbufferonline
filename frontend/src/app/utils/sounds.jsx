// This creates the instance once when the app starts
let popInstance = null;

if (typeof window !== 'undefined') {
  popInstance = new Audio('https://raw.githubusercontent.com/myaseir/brain-buffer-assets/main/pop.mp3');
  popInstance.crossOrigin = "anonymous";
  popInstance.preload = "auto";
  popInstance.volume = 0.4;
}

export const playPopSound = () => {
  if (popInstance) {
    // ⚡ This is the secret to zero delay: 
    // Reset the time to 0 so it can play again immediately even if it's already playing
    popInstance.currentTime = 0; 
    popInstance.play().catch(() => {});
  }
};