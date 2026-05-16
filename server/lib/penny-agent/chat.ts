import {
  createAgentAnalysis,
  normalizePeople,
} from '../bill-analysis'
import {
  getBillChat,
} from '../db'
import {
  readPennyChatRequest,
  resolvePennyChatParticipants,
} from './chat-state'
import {
  billSessionRepo,
  updateBillChatMetadata,
} from './session-storage'
import { runPennySession } from './run'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

export async function runPennyChat(input: any, personId: string, onEvent = (_event: any) => {}) {
  const currentState = input?.chatId
    ? await getBillChat(personId, normalizeText(input.chatId))
    : null
  const current = currentState || null
  const request = readPennyChatRequest(input, current)

  if (!request.incomingMessages.length) {
    throw new Error('At least one message is required to continue the Penny chat.')
  }

  if (!current && !normalizeText(request.latestMessageData.imageBase64) && !normalizeText(request.latestMessageData.rawText)) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const currentSplit = Array.isArray(current?.split) ? current.split : []
  const people = await resolvePennyChatParticipants({
    fallbackPeople: request.people.length
      ? request.people
      : currentSplit.map((entry: any) => entry.person),
    groupId: request.groupId,
    personId,
  })
  const chatId = current?.chatId || (await billSessionRepo.create({
    groupId: request.groupId,
    people,
    personId,
    title: request.title,
  })).getMetadata().then((metadata) => metadata.id)

  if (!current) {
    onEvent({
      type: 'chat_started',
      chatId,
    })
  }

  await updateBillChatMetadata(personId, chatId, {
    groupId: request.groupId,
    people,
    status: 'running',
    summary: current?.receipt
      ? 'Penny is revising the split.'
      : 'Penny is reading the receipt and building the split.',
    title: request.title,
  })

  const sessionResult = await runPennySession({
    chatId,
    current,
    groupId: request.groupId,
    latestMessage: request.latestMessage,
    onEvent,
    people,
    personId,
    title: request.title,
  })

  if (!sessionResult.plan) {
    const summary = normalizeText(sessionResult.message) || 'Penny has an update.'

    await updateBillChatMetadata(personId, chatId, {
      extractedData: sessionResult.receipt || null,
      people,
      status: 'needs_input',
      summary,
      totalCents: Number(sessionResult.receipt?.totalCents || 0),
    })

    return await getBillChat(personId, chatId)
  }

  const nextPeople = normalizePeople(
    Array.isArray(sessionResult.plan?.split)
      ? sessionResult.plan.split.map((entry: any) => entry.person)
      : people,
  )
  const analysis = createAgentAnalysis({
    imageProvided: Boolean(normalizeText(request.latestMessageData.imageBase64)),
    people: nextPeople,
    plan: sessionResult.plan,
    rawReceipt: sessionResult.rawReceipt,
    receipt: sessionResult.receipt,
    title: request.title,
  })

  await updateBillChatMetadata(personId, chatId, {
    currentSplit: sessionResult.plan,
    extractedData: analysis.receipt,
    groupId: request.groupId,
    people: nextPeople,
    status: 'ready',
    summary: analysis.summary,
    title: analysis.title,
    totalCents: analysis.totalCents,
  })

  return await getBillChat(personId, chatId)
}
