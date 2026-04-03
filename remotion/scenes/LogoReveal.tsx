import React from 'react';
import {
	AbsoluteFill,
	useCurrentFrame,
	interpolate,
	spring,
	useVideoConfig,
} from 'remotion';
import {colors, fonts} from '../styles';

export const LogoReveal: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const logoScale = spring({
		frame: frame - 10,
		fps,
		config: {damping: 12, stiffness: 200},
	});
	const textOpacity = interpolate(frame, [25, 40], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const subtitleOpacity = interpolate(frame, [40, 55], [0, 1], {
		extrapolateRight: 'clamp',
	});
	const borderWidth = interpolate(frame, [5, 20], [0, 4], {
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.cream,
				opacity: bgOpacity,
				justifyContent: 'center',
				alignItems: 'center',
				border: `${borderWidth}px solid ${colors.border}`,
			}}
		>
			{/* Monogram */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					transform: `scale(${logoScale})`,
					marginBottom: 24,
				}}
			>
				{[
					{letter: 'A', bg: colors.black, fg: colors.cream, italic: false},
					{letter: 'P', bg: colors.orange, fg: colors.white, italic: true},
				].map((m) => (
					<div
						key={m.letter}
						style={{
							width: 88,
							height: 88,
							backgroundColor: m.bg,
							borderRadius: 14,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<span
							style={{
								fontFamily: fonts.serif,
								fontSize: 56,
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

			{/* Name */}
			<div style={{opacity: textOpacity}}>
				<span
					style={{
						fontFamily: fonts.serif,
						fontSize: 76,
						color: colors.black,
						fontWeight: 700,
					}}
				>
					Agent
					<span style={{color: colors.orange, fontStyle: 'italic'}}>Press</span>
				</span>
			</div>

			{/* Subtitle */}
			<div style={{opacity: subtitleOpacity, marginTop: 14}}>
				<span
					style={{
						fontFamily: fonts.mono,
						fontSize: 18,
						color: colors.muted,
						letterSpacing: '0.2em',
						textTransform: 'uppercase',
					}}
				>
					Autonomous Intelligence Network
				</span>
			</div>
		</AbsoluteFill>
	);
};
