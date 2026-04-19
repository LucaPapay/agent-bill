function formatMoney(amountCents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-US', {
    currency,
    style: 'currency',
  }).format((amountCents || 0) / 100)
}

function normalizeWho(who: string) {
  if (who === 'user' || who === 'penny' || who === 'assistant') {
    return who
  }

  return 'system'
}

function getToolName(entry: any) {
  const directToolName = String(entry?.toolName || '').trim()

  if (directToolName) {
    return directToolName
  }

  const text = String(entry?.text || '').trim()

  if (!/^Tool:\s*/.test(text)) {
    return ''
  }

  return text.replace(/^Tool:\s*/, '').trim()
}

function buildMessageBlock(id: string, entry: any) {
  const toolName = getToolName(entry)

  if (toolName) {
    return {
      id,
      kind: 'tool',
      state: String(entry?.toolState || 'done'),
      toolName,
    }
  }

  return {
    id,
    kind: 'message',
    text: String(entry?.text || '').trim(),
    who: normalizeWho(String(entry?.who || 'system')),
  }
}

function buildGroupChoices(groups: any[]) {
  return groups.map(group => ({
    id: group.id,
    name: group.name,
  }))
}

export function buildVisibleReceiptNotes(notes: any[] = []) {
  return notes.filter((note: string) =>
    !/^Bill time\b/i.test(note)
    && !/^Contains\b.*\bVAT\b/i.test(note)
    && !/^Total matches sum of subtotal and tax\.?$/i.test(note),
  )
}

export function buildScanTranscriptBlocks({
  availableGroups = [],
  canOpenBillComposer = false,
  error = '',
  feedAboveReceipt = [],
  introMessage = '',
  isPennyLoading = false,
  loadingChat = false,
  localMessages = [],
  parsedReceipt = null,
  pennyLoadingStatus = '',
  pinnedBottomFeedEntry = null,
  previewUrl = '',
  selectedGroupName = '',
  showGroupPickerPrompt = false,
  splitRows = [],
  summary = '',
  visibleReceiptNotes = [],
}: any) {
  const blocks: any[] = [{
    id: 'intro',
    kind: 'message',
    text: introMessage,
    who: 'penny',
  }]

  if (!availableGroups.length) {
    blocks.push({
      id: 'empty-groups',
      kind: 'empty-groups',
    })
  }

  localMessages
    .filter((entry: any) => entry.placement === 'before')
    .forEach((entry: any, index: number) => {
      blocks.push({
        id: `local-before-${index}`,
        kind: 'message',
        text: entry.text,
        who: normalizeWho(entry.who),
      })
    })

  if (previewUrl) {
    blocks.push({
      id: 'preview',
      imageSrc: previewUrl,
      kind: 'preview',
      status: pennyLoadingStatus,
      title: selectedGroupName ? `${selectedGroupName} receipt` : 'Receipt preview',
      totalLabel: parsedReceipt
        ? formatMoney(parsedReceipt.totalCents || 0, parsedReceipt.currency || 'EUR')
        : '',
    })
  }

  feedAboveReceipt.forEach((entry: any, index: number) => {
    blocks.push(buildMessageBlock(`feed-top-${index}`, entry))
  })

  if (!parsedReceipt && showGroupPickerPrompt) {
    blocks.push({
      groups: buildGroupChoices(availableGroups),
      id: 'group-picker-top',
      kind: 'group-picker',
    })
  }

  if (error) {
    blocks.push({
      id: 'error',
      kind: 'error',
      text: error,
    })
  }

  if (parsedReceipt) {
    blocks.push({
      id: 'receipt',
      kind: 'receipt',
      receipt: parsedReceipt,
      splitRows,
      summary,
      visibleNotes: visibleReceiptNotes,
    })
  }

  if (canOpenBillComposer) {
    blocks.push({
      id: 'composer-cta',
      kind: 'composer-cta',
      label: splitRows.length ? 'Open bill composer' : 'Open bill composer now',
    })
  }

  if (pinnedBottomFeedEntry) {
    blocks.push(buildMessageBlock('feed-bottom', pinnedBottomFeedEntry))
  }

  if (pinnedBottomFeedEntry && showGroupPickerPrompt) {
    blocks.push({
      groups: buildGroupChoices(availableGroups),
      id: 'group-picker-bottom',
      kind: 'group-picker',
    })
  }

  localMessages
    .filter((entry: any) => entry.placement === 'after')
    .forEach((entry: any, index: number) => {
      blocks.push({
        id: `local-after-${index}`,
        kind: 'message',
        text: entry.text,
        who: normalizeWho(entry.who),
      })
    })

  if (isPennyLoading) {
    blocks.push({
      id: 'loading',
      kind: 'loading',
      loadingChat,
      status: pennyLoadingStatus,
    })
  }

  return blocks
}
