import {loadFont as loadNewsreader} from '@remotion/google-fonts/Newsreader';
import {loadFont as loadJetBrainsMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';

const newsreader = loadNewsreader();
const jetbrains = loadJetBrainsMono();
const inter = loadInter();

export const fonts = {
	serif: newsreader.fontFamily,
	mono: jetbrains.fontFamily,
	sans: inter.fontFamily,
};

export const colors = {
	cream: '#F4F1EC',
	black: '#111111',
	orange: '#E85D04',
	white: '#FFFFFF',
	dark: '#0A0A0A',
	green: '#00FF41',
	muted: '#666666',
	border: '#222222',
	orangeLight: '#FBE5D6',
};
