import { ResidentAvatar, PersonalityType } from '../types/hotel';

const SKIN_TONES = [
  '#FFDFC4', // Fair
  '#F0C08A', // Warm peach
  '#E0AC69', // Tan
  '#C68642', // Warm brown
  '#8D5524', // Deep chestnut
  '#FFE0BD', // Light porcelain
];

const HAIR_COLORS = [
  '#2C1A1D', // Dark brown/black
  '#8B4513', // Auburn brown
  '#D4A373', // Blonde
  '#C0392B', // Vibrant red
  '#8E44AD', // Neon purple
  '#2980B9', // Electric blue
  '#27AE60', // Mint green
  '#F39C12', // Orange ginger
  '#E74C3C', // Pink/Coral
];

const OUTFIT_COLORS = [
  '#E74C3C', // Red
  '#3498DB', // Sky Blue
  '#2ECC71', // Emerald
  '#F1C40F', // Sun Yellow
  '#9B59B6', // Amethyst Purple
  '#1ABC9C', // Turquoise
  '#E67E22', // Bright Orange
  '#34495E', // Navy
  '#FF69B4', // Hot Pink
];

const HAIR_STYLES: ResidentAvatar['hairStyle'][] = [
  'spiky',
  'curly',
  'sleek',
  'bob',
  'afro',
  'ponytail',
  'cap',
  'headphones',
];

export function generateRandomAvatar(personality?: PersonalityType): ResidentAvatar {
  const skinColor = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
  const hairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
  const outfitColor = OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)];
  let hairStyle = HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)];

  let outfitStyle: ResidentAvatar['outfitStyle'] = 'casual';
  let accessory: ResidentAvatar['accessory'] = 'none';
  let eyeType: ResidentAvatar['eyeType'] = 'normal';

  if (personality === 'gamer') {
    hairStyle = 'headphones';
    outfitStyle = 'gamer';
    accessory = 'headset';
    eyeType = 'cool';
  } else if (personality === 'fiestero') {
    accessory = Math.random() > 0.5 ? 'party_hat' : 'sunglasses';
    outfitStyle = 'party';
    eyeType = 'happy';
  } else if (personality === 'elegante') {
    hairStyle = 'sleek';
    outfitStyle = 'suit';
    accessory = 'sunglasses';
    eyeType = 'cool';
  } else if (personality === 'deportista') {
    hairStyle = 'cap';
    outfitStyle = 'sport';
    eyeType = 'happy';
  } else if (personality === 'tímido') {
    hairStyle = 'bob';
    outfitStyle = 'hoodie';
    eyeType = 'sleepy';
  } else if (personality === 'loco') {
    hairStyle = 'spiky';
    accessory = 'party_hat';
    eyeType = 'surprised';
  } else {
    // Random accessory
    const accessories: ResidentAvatar['accessory'][] = ['none', 'none', 'glasses', 'sunglasses', 'flower'];
    accessory = accessories[Math.floor(Math.random() * accessories.length)];
    const eyeTypes: ResidentAvatar['eyeType'][] = ['normal', 'happy', 'cool', 'surprised'];
    eyeType = eyeTypes[Math.floor(Math.random() * eyeTypes.length)];
  }

  return {
    skinColor,
    hairStyle,
    hairColor,
    outfitStyle,
    outfitColor,
    accessory,
    eyeType,
  };
}
