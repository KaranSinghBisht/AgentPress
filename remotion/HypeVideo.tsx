import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ColdOpen} from './scenes/ColdOpen';
import {HeroStatement} from './scenes/HeroStatement';
import {MachineProcess} from './scenes/MachineProcess';
import {OWSShowcase} from './scenes/OWSShowcase';
import {SubscriptionFlow} from './scenes/SubscriptionFlow';
import {AgentEconomy} from './scenes/AgentEconomy';
import {Outro} from './scenes/Outro';
import {Music} from './Music';

export const HypeVideo: React.FC = () => {
	return (
		<AbsoluteFill>
			<Music />

			{/* Scene 1: Brand reveal (0-3.5s) */}
			<Sequence from={0} durationInFrames={105}>
				<ColdOpen />
			</Sequence>

			{/* Scene 2: Hero tagline (3.5-7s) */}
			<Sequence from={105} durationInFrames={105}>
				<HeroStatement />
			</Sequence>

			{/* Scene 3: The machine process + OWS (7-13s) */}
			<Sequence from={210} durationInFrames={180}>
				<MachineProcess />
			</Sequence>

			{/* Scene 4: OWS wallet showcase (13-17s) */}
			<Sequence from={390} durationInFrames={120}>
				<OWSShowcase />
			</Sequence>

			{/* Scene 5: Agents & humans subscribe (17-22s) */}
			<Sequence from={510} durationInFrames={150}>
				<SubscriptionFlow />
			</Sequence>

			{/* Scene 6: Agent economy stats (22-26s) */}
			<Sequence from={660} durationInFrames={120}>
				<AgentEconomy />
			</Sequence>

			{/* Scene 7: Outro (26-30s) */}
			<Sequence from={780} durationInFrames={120}>
				<Outro />
			</Sequence>
		</AbsoluteFill>
	);
};
