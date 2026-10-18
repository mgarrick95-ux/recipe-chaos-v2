import Image from 'next/image';

const sceneCopy = {
  library: 'Psst. I checked—these look worth keeping.',
  empty: 'Not even a suspicious crumb. Shall we make a little mess?',
} as const;

type LilGrimmScene = keyof typeof sceneCopy;

export function LilGrimm({ scene, className = '' }: { scene: LilGrimmScene; className?: string }) {
  return <aside className={`lil-grimm lil-grimm-${scene} ${className}`.trim()} aria-label="A note from Lil Grimmy">
    <p className="grimmy-bubble"><span className="sr-only">Lil Grimmy says: </span>{sceneCopy[scene]}</p>
    <div className="grimmy-stage" aria-hidden="true">
      <Image className="grimmy-image" src="/brand/lil-grimmy.png" alt="" width={1222} height={1287} sizes={scene === 'empty' ? '(max-width: 639px) 9rem, 14rem' : '(max-width: 639px) 7rem, 12rem'} />
    </div>
  </aside>;
}
