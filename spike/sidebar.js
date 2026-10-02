/* global document, Image */
// Stage 5.0/0 spike. Throwaway. The desktop sidebar's team slots, following
// the shipped unlock schedule (data/partyTuning.ts SLOT_UNLOCK_SCHEDULE,
// [2, 3, 3, 4, 4, 5, 5, 6, 6] by gyms cleared) rather than six fixed slots.
const SCHEDULE = [2, 3, 3, 4, 4, 5, 5, 6, 6];
export function renderSlots(host, team, gymsCleared) {
  const open = SCHEDULE[gymsCleared];
  const slots = [];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    if (i >= open) {
      const at = SCHEDULE.findIndex((n) => n > i);
      s.className = 'slot slot--locked';
      s.style.fontSize = '10px';
      s.textContent = `Gym ${at}`;
    } else {
      s.className = 'slot';
      const id = team[i];
      if (id) {
        const img = new Image();
        img.src = `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
        img.alt = id;
        img.style.cssText = 'width:48px;height:48px;object-fit:contain;image-rendering:pixelated';
        s.append(img);
      }
    }
    slots.push(s);
  }
  host.replaceChildren(...slots);
}
