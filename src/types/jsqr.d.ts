declare module 'jsqr' {
  export interface QRCode {
    binaryData: number[];
    data: string;
    chunks: any[];
    location: {
      topRightCorner: { x: number; y: number };
      topLeftCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
      topRightFinderPattern: { x: number; y: number };
      topLeftFinderPattern: { x: number; y: number };
      bottomLeftFinderPattern: { x: number; y: number };
      bottomRightAlignmentPattern?: { x: number; y: number };
    };
  }
  function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: any): QRCode | null;
  export default jsQR;
}
