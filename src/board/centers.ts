type Center = (cellId: string) => {
    x: number;
    y: number;
} | null;
let provider: Center = () => null;
export function registerBoardCenters(next: Center): () => void {
    provider = next;
    return () => {
        if (provider === next)
            provider = () => null;
    };
}
export function boardCellCenter(cellId: string) {
    return provider(cellId);
}
