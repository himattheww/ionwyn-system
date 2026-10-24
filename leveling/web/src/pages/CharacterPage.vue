<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { api, formatDate, refreshEvent, useLoad, type CharacterState } from '../lib/api.ts'
import AttributeOrb from '../components/AttributeOrb.vue'
import RadarChart from '../components/RadarChart.vue'
import StateView from '../components/StateView.vue'

interface CharacterResponse {
  state: CharacterState | null
  calculatedAt?: string
  recentAchievements?: { id: string; name: string; date: string }[]
}

const { data, loading, error, reload } = useLoad(() => api<CharacterResponse>('/character'))
const percent = (value: number, total: number) => `${Math.min(100, Math.round((value / total) * 100))}%`
const num = (value: number) => value.toLocaleString('id-ID')
const score = (value: number) => value.toFixed(2).replace('.', ',')
const attributeName = (key: string) => data.value?.state?.attributes.find(a => a.key === key)?.name ?? key

onMounted(() => window.addEventListener(refreshEvent, reload))
onUnmounted(() => window.removeEventListener(refreshEvent, reload))
</script>

<template>
  <StateView :loading="loading" :error="error" :empty="!data?.state" empty-text="Belum ada data karakter. Buka halaman Sumber lalu tekan Hitung ulang." @retry="reload">
    <template v-if="data?.state">
      <section class="hero">
        <div class="hero-title">
          <span class="kicker">Tier {{ data.state.tier }}</span>
          <h1>Level {{ data.state.level }}</h1>
          <p class="deck">
            {{ data.state.className }} · {{ data.state.subclassName ?? 'tanpa subkelas' }}<template v-if="data.state.specialization">, spesialis {{ data.state.specialization }}</template>.
            Karakter dihitung dari aktivitas nyata di semua aplikasi.
          </p>
          <div class="hero-exp">
            <div class="row small">
              <span class="kicker">Exp</span>
              <span class="num">{{ num(data.state.levelExp) }} / {{ num(data.state.levelNeed) }}</span>
            </div>
            <div class="bar thick accent"><span :style="{ width: percent(data.state.levelExp, data.state.levelNeed) }" /></div>
            <p class="small muted">Total {{ num(data.state.totalExp) }} exp · menuju level {{ data.state.level + 1 }}</p>
          </div>
        </div>
        <div class="rune">
          <svg class="rune-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="96" class="rune-dots" />
            <circle cx="100" cy="100" r="84" class="rune-dash" />
          </svg>
          <AttributeOrb class="hero-orb" :attributes="data.state.attributes" />
        </div>
      </section>

      <section class="columns">
        <div class="col">
          <div>
            <h3>Atribut</h3>
            <p class="small muted">Skor dihitung dari exp 30 hari terhadap target.</p>
          </div>
          <RadarChart :items="data.state.attributes" />
          <div class="list">
            <div v-for="attribute in data.state.attributes" :key="attribute.key" class="attribute">
              <div class="row">
                <span class="attr-name">{{ attribute.name }} <span class="muted">· Lv {{ attribute.level }}</span></span>
                <span class="small muted">{{ num(attribute.exp30) }} exp / 30 hari · skor {{ score(attribute.score) }}</span>
              </div>
              <div class="bar"><span :style="{ width: percent(attribute.levelExp, attribute.levelNeed) }" /></div>
            </div>
          </div>
        </div>

        <div class="col">
          <div>
            <h3>Quest minggu ini</h3>
            <p class="small muted">Quest selesai memberi exp tanpa terkena batas harian.</p>
          </div>
          <p v-if="data.state.quests.length === 0" class="lede muted">Belum ada quest minggu ini.</p>
          <div class="list wide">
            <div v-for="quest in data.state.quests" :key="quest.id" class="quest">
              <div class="row">
                <span class="kicker accent">{{ attributeName(quest.attribute) }}</span>
                <span v-if="quest.doneDate" class="tag tag-accent-2">Selesai {{ formatDate(quest.doneDate) }}</span>
              </div>
              <div class="quest-label">{{ quest.label }}</div>
              <div class="quest-progress">
                <div class="bar thick" :class="quest.doneDate ? 'done' : 'accent'"><span :style="{ width: percent(quest.progress, quest.target) }" /></div>
                <span class="small num">{{ quest.progress }} / {{ quest.target }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="col wide-gap">
          <div class="streak">
            <h3>Streak Catatan Malam</h3>
            <div class="streak-figure">
              <span class="streak-num">{{ data.state.streak.current }}</span>
              <em>malam</em>
            </div>
            <p class="small muted">Terbaik {{ data.state.streak.best }} malam.</p>
          </div>
          <div class="list">
            <h3>Achievement terbaru</h3>
            <p v-if="!data.recentAchievements?.length" class="lede muted">Belum ada achievement.</p>
            <div v-for="item in data.recentAchievements" :key="item.id" class="recent">
              <span>{{ item.name }}</span>
              <span class="small muted">{{ formatDate(item.date) }}</span>
            </div>
            <RouterLink to="/achievement" class="small">Semua achievement →</RouterLink>
          </div>
        </div>
      </section>
    </template>
  </StateView>
</template>

<style scoped src="../styles/character.css"></style>
