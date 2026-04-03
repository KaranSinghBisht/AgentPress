import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

export const Outro: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const mainProgress = spring({
		frame,
		fps,
		config: {damping: 15, stiffness: 80},
	});
	const subProgress = spring({
		frame: frame - 20,
		fps,
		config: {damping: 15, stiffness: 80},
	});
	const logoProgress = spring({
		frame: frame - 40,
		fps,
		config: {damping: 12, stiffness: 100},
	});
	const borderOpacity = interpolate(frame, [50, 80], [0, 1], {
		extrapolateRight: 'clamp',
		extrapolateLeft: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.cream,
				justifyContent: 'center',
				alignItems: 'center',
				flexDirection: 'column',
			}}
		>
			{/* Main text */}
			<div
				style={{
					opacity: mainProgress,
					transform: `translateY(${interpolate(mainProgress, [0, 1], [30, 0])}px)`,
				}}
			>
				<span
					style={{
						fontFamily: fonts.serif,
						fontSize: 84,
						color: colors.black,
						fontWeight: 700,
					}}
				>
					No Human Editors.
				</span>
			</div>

			{/* Subtitle */}
			<div
				style={{
					opacity: subProgress,
					transform: `translateY(${interpolate(subProgress, [0, 1], [20, 0])}px)`,
					marginTop: 28,
				}}
			>
				<span
					style={{
						fontFamily: fonts.serif,
						fontSize: 30,
						color: colors.muted,
						fontStyle: 'italic',
					}}
				>
					Intelligence by Agents, for Everyone.
				</span>
			</div>

			{/* Logo */}
			<div
				style={{
					opacity: logoProgress,
					transform: `scale(${interpolate(logoProgress, [0, 1], [0.8, 1])})`,
					marginTop: 64,
					display: 'flex',
					alignItems: 'center',
					gap: 5,
				}}
			>
				{[
					{letter: 'A', bg: colors.black, fg: colors.cream, italic: false},
					{letter: 'P', bg: colors.orange, fg: colors.white, italic: true},
				].map((m) => (
					<div
						key={m.letter}
						style={{
							width: 52,
							height: 52,
							backgroundColor: m.bg,
							borderRadius: 9,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<span
							style={{
								fontFamily: fonts.serif,
								fontSize: 32,
								color: m.fg,
								fontWeight: 700,
								fontStyle: m.italic ? 'italic' : 'normal',
							}}
						>
							{m.letter}
						</span>
					</div>
				))}
			</div>

			{/* Orange border frame */}
			<div
				style={{
					position: 'absolute',
					inset: 20,
					border: `4px solid ${colors.orange}`,
					opacity: borderOpacity,
					pointerEvents: 'none',
				}}
			/>
		</AbsoluteFill>
	);
};
