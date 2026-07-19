import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, StatCard } from '../components/ui/PageHeader'
import { usePortfolio } from '../context/PortfolioContext'
import { evaluateAchievements } from '../domain/achievements'
import { privacyClass } from '../utils/format'

export function AchievementsPage() {
  const { data, breakdown, goalProgress, privacy } = usePortfolio()

  const evalResult = useMemo(
    () =>
      evaluateAchievements({
        data,
        breakdown,
        goalProgress,
      }),
    [data, breakdown, goalProgress],
  )

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="Achievements"
        description="Milestones unlocked from your live portfolio — XP grows with history depth."
      />

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px mb-8 ${privacyClass(privacy)}`}>
        <StatCard label="Level" value={`L${evalResult.level}`} hint={`${evalResult.xp} XP`} />
        <StatCard
          label="Level progress"
          value={`${evalResult.levelProgress.toFixed(0)}%`}
          hint="To next level"
        />
        <StatCard
          label="Unlocked"
          value={`${evalResult.unlocked.length}/${evalResult.unlocked.length + evalResult.locked.length}`}
        />
        <StatCard label="Financial score" value={String(evalResult.score)} hint="0–1000 composite" />
      </div>

      <div className="surface p-6 mb-px">
        <p className="label-uppercase mb-3">XP bar</p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${evalResult.levelProgress}%` }} />
        </div>
      </div>

      <p className="label-uppercase mb-4 mt-8">Unlocked</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px mb-8">
        {evalResult.unlocked.map((a) => (
          <div key={a.id} className="surface p-6 border-l-2 border-l-accent">
            <p className="text-2xl mb-2" aria-hidden>
              {a.icon}
            </p>
            <h3 className="font-bold tracking-tight mb-1">{a.name}</h3>
            <p className="text-sm text-text-muted font-light mb-3">{a.desc}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">+{a.xp} XP</p>
          </div>
        ))}
        {evalResult.unlocked.length === 0 && (
          <div className="surface p-10 text-center text-text-subtle col-span-full">
            Keep tracking — unlocks appear as you hit milestones.
          </div>
        )}
      </div>

      <p className="label-uppercase mb-4">Locked</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px">
        {evalResult.locked.map((a) => (
          <div key={a.id} className="surface p-6 opacity-50">
            <p className="text-2xl mb-2" aria-hidden>
              {a.icon}
            </p>
            <h3 className="font-bold tracking-tight mb-1">{a.name}</h3>
            <p className="text-sm text-text-muted font-light mb-3">{a.desc}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-subtle">
              +{a.xp} XP · {a.category}
            </p>
          </div>
        ))}
      </div>

      <div className="thumb-cta-bar" role="toolbar" aria-label="Primary achievements actions">
        <Link to="/" className="btn-primary btn-sm">
          Today
        </Link>
        <Link to="/goals" className="btn-secondary btn-sm">
          Goals
        </Link>
      </div>
      <div className="thumb-cta-bar-spacer" aria-hidden />
    </div>
  )
}
