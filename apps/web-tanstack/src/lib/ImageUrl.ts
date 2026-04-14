type ImageParams = {
	imageId?: string | null;
	width?: number | null;
	height?: number | null;
};

export const getImageUrl = ({ imageId, width, height }: ImageParams) => {
	if (!imageId) {
		return "/No-Image-Placeholder.svg.webp";
	}
	const baseUrl = "https://vndb-t.galzy.moe";

	return width && width > 256 && height && height > 400
		? `${baseUrl}/${imageId.substring(
				0,
				2,
			)}.t/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`
		: `${baseUrl}/${imageId.substring(
				0,
				2,
			)}/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`;
};

// export function imageAcc(name: string) {
//   return `${process.env.NEXT_PUBLIC_OPENIMAG_P_HOST}/p/upload/${name}`
// }
