import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { LogsExplorerPage } from 'pages/project/[ref]/logs/explorer/index'
import { clickDropdown } from 'tests/helpers'
import { customRender as render } from 'tests/lib/custom-render'
import { routerMock } from 'tests/lib/route-mock'
import { beforeAll, describe, expect, test, vi } from 'vitest'

const router = routerMock

beforeAll(() => {
  vi.doMock('common', async (importOriginal: () => Promise<any>) => {
    const mod = await importOriginal()

    return {
      ...mod,
      IS_PLATFORM: true,
      useIsLoggedIn: vi.fn(),
      useParams: vi.fn(() => ({ ref: 'projectRef' })),
    }
  })
  vi.mock('lib/gotrue', () => ({
    auth: { onAuthStateChange: vi.fn() },
  }))
})

test.skip('can display log data', async () => {
  const { container } = render(<LogsExplorerPage dehydratedState={{}} />)
  let editor = container.querySelector('.monaco-editor')
  await waitFor(() => {
    editor = container.querySelector('.monaco-editor')
    expect(editor).toBeTruthy()
  })

  if (!editor) {
    throw new Error('editor not found')
  }

  await userEvent.type(editor, 'select \ncount(*) as my_count \nfrom edge_logs')
  await screen.findByText(/Save query/)
  const button = await screen.findByTitle('run-logs-query')
  await userEvent.click(button)
  const row = await screen.findByText(/timestamp/)
  await userEvent.click(row)
  await screen.findByText(/metadata/)
  await screen.findByText(/request/)
})

test('q= query param will populate the query input', async () => {
  router.query = { ...router.query, type: 'api', q: 'some_query' }

  render(<LogsExplorerPage dehydratedState={{}} />)
})

test('ite= and its= query param will populate the datepicker', async () => {
  const start = dayjs().subtract(1, 'day')
  const end = dayjs()
  router.query = {
    ...router.query,
    type: 'api',
    q: 'some_query',
    its: start.toISOString(),
    ite: end.toISOString(),
  }

  render(<LogsExplorerPage dehydratedState={{}} />)
})

test.skip('custom sql querying', async () => {
  const { container } = render(<LogsExplorerPage dehydratedState={{}} />)

  let editor = container.querySelector('.monaco-editor')
  if (!editor) {
    throw new Error('editor not found')
  }

  // type new query
  await userEvent.type(editor, 'select \ncount(*) as my_count \nfrom edge_logs')

  // run query by button
  await userEvent.click(await screen.findByText('Run'))

  // run query by editor
  await userEvent.type(editor, '\nlimit 123{ctrl}{enter}')

  await screen.findByText(/my_count/) //column header
  const rowValue = await screen.findByText(/12345/) // row value

  // clicking on the row value should not show log selection panel
  await userEvent.click(rowValue)
  await expect(screen.findByText(/Metadata/)).rejects.toThrow()

  // should not see chronological features
  await expect(screen.findByText(/Load older/)).rejects.toThrow()
})

test.skip('bug: can edit query after selecting a log', async () => {
  const { container } = render(<LogsExplorerPage dehydratedState={{}} />)
  // run default query
  await userEvent.click(await screen.findByText('Run'))
  const rowValue = await screen.findByText(/12345/) // row value
  // open up an show selection panel
  await userEvent.click(rowValue)
  await screen.findByText('Copy')

  // change the query
  let editor = container.querySelector('.monaco-editor')

  if (!editor) {
    throw new Error('editor not found')
  }

  // type new query
  await userEvent.click(editor)
  await userEvent.type(editor, ' something')
  await userEvent.type(editor, '\nsomething{ctrl}{enter}')
  await userEvent.click(await screen.findByText('Run'))

  // closes the selection panel
  await expect(screen.findByText('Copy')).rejects.toThrow()
})

test.skip('query warnings', async () => {
  router.query = {
    ...router.query,
    q: 'some_query',
    its: dayjs().subtract(10, 'days').toISOString(),
    ite: dayjs().toISOString(),
  }

  render(<LogsExplorerPage dehydratedState={{}} />)
  await screen.findByText('1 warning')
})

test('field reference', async () => {
  render(<LogsExplorerPage dehydratedState={{}} />)
  await userEvent.click(await screen.findByText('Field Reference'))
  await screen.findByText('metadata.request.cf.asOrganization')
})

describe.each(['free', 'pro', 'team', 'enterprise'])('upgrade modal for %s', (key) => {
  test.skip('based on query params', async () => {
    router.query = {
      ...router.query,
      q: 'some_query',
      its: dayjs().subtract(5, 'month').toISOString(),
      ite: dayjs().toISOString(),
    }

    render(<LogsExplorerPage dehydratedState={{}} />)
    await screen.findByText(/Log retention/) // assert modal title is present
  })
  test.skip('based on datepicker helpers', async () => {
    render(<LogsExplorerPage dehydratedState={{}} />)
    clickDropdown(screen.getByText('Last hour'))
    await waitFor(async () => {
      const option = await screen.findByText('Last 3 days')
      fireEvent.click(option)
    })
    // only Free Plan will show modal
    if (key === 'free') {
      await screen.findByText('Log retention') // assert modal title is present
    } else {
      await expect(screen.findByText('Log retention')).rejects.toThrow()
    }
  })
})
