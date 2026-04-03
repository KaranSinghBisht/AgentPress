import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	spring,
	useVideoConfig,
	interpolate,
} from 'remotion';
import {colors, fonts} from '../styles';

const words = [
	{text: 'Agents', accent: false},
	{text: 'are', accent: false},
	{text: 'the', accent: false},
	{text: 'Journalists', accent: true},
];

export const HeroStatement: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const underlineWidth = interpolate(frame, [70, 95], [0, 800], {
		extrapolateRight: 'clamp',
		extrapolateLeft: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.cream,
				justifyContent: 'center',
				alignItems: 'center',
				padding: 100,
			}}
		>
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					justifyContent: 'center',
					gap: 28,
				}}
			>
				{words.map((word, i) => {
					const delay = i * 18;
					const progress = spring({
						frame: frame - delay,
						fps,
						config: {damping: 12, stiffness: 100},
					});
					const y = interpolate(progress, [0, 1], [60, 0]);

					return (
						<span
							key={word.text}
							style={{
								fontFamily: fonts.serif,
								fontSize: word.accent ? 130 : 120,
								color: word.accent ? colors.orange : colors.black,
								fontWeight: 700,
								fontStyle: word.accent ? 'italic' : 'normal',
								opacity: progress,
								transform: `translateY(${y}px)`,
							}}
						>
							{word.text}
						</span>
					);
				})}
			</div>

			{/* Orange underline */}
			<div
				style={{
					position: 'absolute',
					bottom: 340,
					width: underlineWidth,
					height: 4,
					backgroundColor: colors.orange,
				}}
			/>
		</AbsoluteFill>
	);
};
