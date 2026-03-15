<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useClients } from '@/composables/useClients'
import type { Client } from '@/lib/types'
import type { ClientFormData } from '@/utils/validators'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import ClientGrid from '@/components/clients/ClientGrid.vue'
import ClientForm from '@/components/clients/ClientForm.vue'

const { clients, loading, error, fetchClients, createClient, updateClient, deleteClient } = useClients()

const showFormModal = ref(false)
const showDeleteModal = ref(false)
const formLoading = ref(false)
const selectedClient = ref<Client | null>(null)
const clientToDelete = ref<Client | null>(null)

function openCreate() {
  selectedClient.value = null
  showFormModal.value = true
}

function openEdit(client: Client) {
  selectedClient.value = client
  showFormModal.value = true
}

function openDeleteConfirm(client: Client) {
  clientToDelete.value = client
  showDeleteModal.value = true
}

async function handleSubmit(formData: ClientFormData) {
  formLoading.value = true
  if (selectedClient.value) {
    await updateClient(selectedClient.value.id, formData)
  } else {
    await createClient(formData)
  }
  formLoading.value = false
  showFormModal.value = false
  selectedClient.value = null
}

async function handleDelete() {
  if (!clientToDelete.value) return
  await deleteClient(clientToDelete.value.id)
  showDeleteModal.value = false
  clientToDelete.value = null
}

onMounted(() => fetchClients())
</script>

<template>
  <div class="space-y-5 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-bold text-[#111827]">Clients</h1>
        <p class="text-sm text-[#6B7280] mt-0.5">
          {{ clients.length }} client{{ clients.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <Button variant="default" size="md" @click="openCreate">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nouveau client
      </Button>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-sm text-[#DC2626]"
    >
      {{ error }}
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="n in 6"
          :key="n"
          class="h-36 bg-[#F3F4F6] rounded-xl animate-pulse"
        />
      </div>
    </template>

    <!-- Empty state -->
    <template v-else-if="clients.length === 0 && !error">
      <div class="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center">
        <div class="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="h-6 w-6 text-[#D1D5DB]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 class="text-sm font-semibold text-[#374151] mb-1">Aucun client</h3>
        <p class="text-sm text-[#9CA3AF] mb-4">Ajoutez votre premier client pour commencer à facturer.</p>
        <Button variant="default" size="sm" @click="openCreate">Ajouter un client</Button>
      </div>
    </template>

    <!-- Client grid -->
    <ClientGrid
      v-else
      :clients="clients"
      @edit="openEdit"
      @delete="openDeleteConfirm"
    />

    <!-- Create/Edit modal -->
    <Modal
      v-model="showFormModal"
      :title="selectedClient ? 'Modifier le client' : 'Nouveau client'"
      size="lg"
    >
      <ClientForm
        :client="selectedClient"
        :loading="formLoading"
        @submit="handleSubmit"
        @cancel="showFormModal = false"
      />
    </Modal>

    <!-- Delete confirmation modal -->
    <Modal
      v-model="showDeleteModal"
      title="Supprimer le client"
      size="sm"
    >
      <p class="text-sm text-[#374151]">
        Êtes-vous sûr de vouloir supprimer
        <span class="font-semibold">{{ clientToDelete?.name }}</span> ?
        Cette action est irréversible.
      </p>

      <template #footer>
        <Button variant="ghost" @click="showDeleteModal = false">Annuler</Button>
        <Button variant="destructive" @click="handleDelete">Supprimer</Button>
      </template>
    </Modal>
  </div>
</template>
