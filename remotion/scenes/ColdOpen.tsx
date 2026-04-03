import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

export const ColdOpen: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Horizontal line draws from center
	const lineWidth = interpolate(frame, [0, 20], [0, 100], {
		extrapolateRight: 'clamp',
	});

	// Monogram appears
	const logoProgress = spring({
		frame: frame - 15,
		fps,
		config: {damping: 14, stiffness: 160},
	});

	// Title text
	const titleOpacity = interpolate(frame, [35, 50], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const titleY = interpolate(frame, [35, 50], [20, 0], {
		extrapolateRight: 'clamp',
	});

	// Subtitle
	const subOpacity = interpolate(frame, [55, 68], [0, 1], {
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#0D0D0D',
				justifyContent: 'center',
				alignItems: 'center',
				flexDirection: 'column',
			}}
		>
			{/* Subtle radial glow */}
			<div
				style={{
					position: 'absolute',
					width: 600,
					height: 600,
					borderRadius: '50%',
					background: `radial-gradient(circle, ${colors.orange}12 0%, transparent 70%)`,
					opacity: interpolate(frame, [10, 30], [0, 1], {
						extrapolateRight: 'clamp',
					}),
				}}
			/>

			{/* Horizontal accent line */}
			<div
				style={{
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, 60px)',
					width: `${lineWidth}%`,
					height: 2,
					backgroundColor: colors.orange,
				}}
			/>

			{/* Monogram */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8,
					transform: `scale(${logoProgress})`,
					opacity: logoProgress,
					marginBottom: 20,
				}}
			>
				{[
					{letter: 'A', bg: colors.white, fg: '#0D0D0D', italic: false},
					{letter: 'P', bg: colors.orange, fg: colors.white, italic: true},
				].map((m) => (
					<div
						key={m.letter}
						style={{
							width: 100,
							height: 100,
							backgroundColor: m.bg,
							borderRadius: 16,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<span
							style={{
								fontFamily: fonts.serif,
								fontSize: 64,
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

			{/* Title */}
			<div
				style={{
					opacity: titleOpacity,
					transform: `translateY(${titleY}px)`,
					marginBottom: 12,
				}}
			>
				<span
					style={{
						fontFamily: fonts.serif,
						fontSize: 72,
						color: colors.white,
						fontWeight: 700,
					}}
				>
					Agent
					<span style={{color: colors.orange, fontStyle: 'italic'}}>Press</span>
				</span>
			</div>

			{/* Subtitle */}
			<div style={{opacity: subOpacity}}>
				<span
					style={{
						fontFamily: fonts.mono,
						fontSize: 16,
						color: colors.muted,
						letterSpacing: '0.25em',
						textTransform: 'uppercase',
					}}
				>
					Autonomous Intelligence Network
				</span>
			</div>
		</AbsoluteFill>
	);
};
